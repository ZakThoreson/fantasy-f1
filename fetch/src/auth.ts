import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { redactError } from './redact.js';

const FANTASY_HOME_URL = 'https://fantasy.formula1.com/en/';
const BY_PASSWORD_URL_PART = '/v2/account/subscriber/authenticate/by-password';
const NAV_TIMEOUT_MS = 30_000;
const RESPONSE_TIMEOUT_MS = 30_000;
const FILL_RETRY_ATTEMPTS = 3;
// Observed taking ~20-30s on GitHub-hosted runners (vs. near-instant on a
// local dev machine) — plausibly Akamai adding friction for a datacenter/
// headless client. Generous timeout with margin over what's been observed.
const REESE84_COOKIE_TIMEOUT_MS = 45_000;
const REESE84_POLL_INTERVAL_MS = 1_000;

/**
 * The login form is interactive (fillable) before Akamai's sensor JS has
 * actually finished and set the reese84 cookie — confirmed via diagnostics
 * showing a disabled/loading overlay on the Sign In button at that point.
 * Clicking before reese84 exists submits nothing useful. Poll for it instead
 * of assuming any fixed page-load event means the page is truly ready.
 */
async function waitForReese84Cookie(
  context: BrowserContext,
  timeoutMs: number,
): Promise<{ found: boolean; waitedMs: number }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const cookies = await context.cookies();
    if (cookies.some((c) => c.name === 'reese84')) {
      return { found: true, waitedMs: Date.now() - start };
    }
    await new Promise((resolve) => setTimeout(resolve, REESE84_POLL_INTERVAL_MS));
  }
  return { found: false, waitedMs: Date.now() - start };
}

/**
 * React can reset a controlled input's DOM value back to its own state on a
 * re-render shortly after page load (e.g. late hydration), silently undoing a
 * `.fill()` with no error. Verify the value actually stuck and retry if not,
 * pausing briefly to let the app finish settling before trying again.
 */
async function fillAndVerify(locator: Locator, value: string): Promise<boolean> {
  for (let attempt = 1; attempt <= FILL_RETRY_ATTEMPTS; attempt++) {
    await locator.fill(value);
    if ((await locator.inputValue()) === value) {
      return true;
    }
    await locator.page().waitForTimeout(500 * attempt);
  }
  return false;
}

/**
 * Captures a screenshot + page state to `diagnostics/` so a failed CI run
 * leaves behind something inspectable instead of just an error message.
 * Uploaded as a workflow artifact by update-data.yml — never committed to the
 * repo (see .gitignore) since a screenshot could show account details.
 * Field contents are reported as filled/empty only, never the actual values.
 */
async function captureDiagnostics(
  page: Page,
  outDir: string,
  label: string,
  extra: Record<string, unknown> = {},
): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const notes: string[] = [];

  try {
    await page.screenshot({ path: path.join(outDir, `${label}.png`), fullPage: true });
    notes.push(`${label} screenshot saved`);
  } catch (e) {
    notes.push(`${label} screenshot failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const cookies = await page.context().cookies();
    const summary = {
      label,
      url: page.url(),
      title: await page.title().catch(() => '(unavailable)'),
      hasReese84Cookie: cookies.some((c) => c.name === 'reese84'),
      cookieNames: cookies.map((c) => c.name),
      timestamp: new Date().toISOString(),
      ...extra,
    };
    await writeFile(path.join(outDir, `${label}.json`), JSON.stringify(summary, null, 2), 'utf8');
    notes.push(`${label} state: ${JSON.stringify(summary)}`);
  } catch (e) {
    notes.push(`${label} state capture failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  return notes;
}

/**
 * Logs in to F1's account system via a real headless browser so Akamai Bot
 * Manager's anti-bot JS runs exactly as it would for a real user (the reese84
 * cookie it produces cannot be hand-constructed). Rather than re-issuing the
 * by-password call ourselves, we let the page's own JS make it and intercept
 * the response to read the subscriptionToken — more resilient to F1 changing
 * exactly how that call is shaped, since we're not replicating it by hand.
 *
 * Fragile by nature: F1/Akamai can change the login page markup or
 * bot-detection at any time, breaking this. See README "Known limitations".
 */
export async function getSubscriptionToken(
  username: string,
  password: string,
  diagnosticsDir = path.resolve(process.cwd(), 'diagnostics'),
): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  let page: Page | undefined;
  try {
    const context = await browser.newContext();
    page = await context.newPage();
    page.setDefaultTimeout(NAV_TIMEOUT_MS);

    const byPasswordResponse = page.waitForResponse(
      (res) => res.url().includes(BY_PASSWORD_URL_PART),
      { timeout: RESPONSE_TIMEOUT_MS },
    );

    // Deep-linking straight to account.formula1.com's login URL was never
    // actually confirmed to work — every prior manual inspection reached that
    // page by clicking through from fantasy.formula1.com's own Sign In
    // button. Repeated silent form resets with no error suggest that click-
    // through path may set session/referrer state a direct deep link skips,
    // so replicate the real user path instead of shortcutting it.
    await page.goto(FANTASY_HOME_URL, { waitUntil: 'load' });

    // Best-effort cookie-consent / announcement-popup dismissal; non-fatal if
    // absent (these vary and aren't load-bearing for the actual login).
    try {
      await page
        .frameLocator('iframe[title="SP Consent Message"]')
        .getByRole('button', { name: /accept/i })
        .click({ timeout: 5_000 });
    } catch {
      // No consent dialog shown — proceed.
    }
    try {
      await page
        .locator(
          '.si-popup__wrap--announcement button, .si-popup__wrap--announcement .si-popup__close',
        )
        .first()
        .click({ timeout: 3_000 });
    } catch {
      // No announcement popup shown — proceed.
    }

    await page
      .getByRole('button', { name: /^sign in$/i })
      .first()
      .click({ force: true });
    await page.waitForURL(/account\.formula1\.com/, { timeout: NAV_TIMEOUT_MS });

    const loginField = page.locator('input[name="Login"]');
    const passwordField = page.locator('input[name="Password"]');

    const loginFilled = await fillAndVerify(loginField, username);
    const passwordFilled = await fillAndVerify(passwordField, password);

    // Always captured (not just on failure) — this is the one moment that
    // would show whether the fields visually held their values right before
    // submitting, which a later failure screenshot can no longer prove either
    // way once the app has re-rendered.
    await captureDiagnostics(page, diagnosticsDir, 'after-fill', {
      loginFieldFilled: loginFilled,
      passwordFieldFilled: passwordFilled,
    });

    if (!loginFilled || !passwordFilled) {
      throw new Error(
        `Could not get the login form to hold its values (login filled: ${loginFilled}, password filled: ${passwordFilled}) after ${FILL_RETRY_ATTEMPTS} attempts.`,
      );
    }

    const reese84 = await waitForReese84Cookie(context, REESE84_COOKIE_TIMEOUT_MS);
    await captureDiagnostics(page, diagnosticsDir, 'before-submit', {
      reese84WaitedMs: reese84.waitedMs,
      reese84Found: reese84.found,
    });
    if (!reese84.found) {
      throw new Error(
        `Timed out after ${REESE84_COOKIE_TIMEOUT_MS}ms waiting for Akamai's reese84 cookie — it never arrived, so submitting would be pointless. Akamai may be blocking this runner outright rather than just being slow.`,
      );
    }

    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    // Catches a transient validation error/toast that a screenshot taken only
    // after the full response timeout would likely miss if it auto-dismisses.
    await page.waitForTimeout(2_000);
    await captureDiagnostics(page, diagnosticsDir, 'just-after-click');

    const response = await byPasswordResponse;
    if (!response.ok()) {
      throw new Error(
        `F1 login rejected: ${response.status()} ${response.statusText()} — check credentials or account status.`,
      );
    }

    const body = (await response.json()) as { data?: { subscriptionToken?: string } };
    const token = body.data?.subscriptionToken;
    if (!token) {
      throw new Error(
        'F1 login response did not include a subscriptionToken — F1 may have changed their login flow.',
      );
    }

    return token;
  } catch (err) {
    let diagnosticsNote = 'diagnostics not captured (no page available)';
    if (page) {
      const notes = await captureDiagnostics(page, diagnosticsDir, 'failure').catch(
        (e: unknown) => [
          `diagnostics capture threw: ${e instanceof Error ? e.message : String(e)}`,
        ],
      );
      diagnosticsNote = notes.join('; ');
    }
    const original = err instanceof Error ? err.message : String(err);
    throw redactError(new Error(`${original} | ${diagnosticsNote}`), [username, password]);
  } finally {
    await browser.close();
  }
}
