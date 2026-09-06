import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { redactError } from './redact.js';

const LOGIN_URL =
  'https://account.formula1.com/#/en/login?redirect=https%3A%2F%2Ffantasy.formula1.com%2Fen&lead_source=web_fantasy';
const BY_PASSWORD_URL_PART = '/v2/account/subscriber/authenticate/by-password';
const NAV_TIMEOUT_MS = 30_000;
const RESPONSE_TIMEOUT_MS = 30_000;

/**
 * On any failure, captures a screenshot + page state to `diagnostics/` so a
 * CI failure leaves behind something inspectable (is it a CAPTCHA? a changed
 * login form? a blank page?) instead of just a bare timeout message. Uploaded
 * as a workflow artifact by update-data.yml on failure — never committed to
 * the repo (see .gitignore) since a screenshot could show account details.
 */
async function captureDiagnostics(page: Page, outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const notes: string[] = [];

  try {
    await page.screenshot({ path: path.join(outDir, 'failure.png'), fullPage: true });
    notes.push('screenshot saved');
  } catch (e) {
    notes.push(`screenshot failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const cookies = await page.context().cookies();
    const hasReese84 = cookies.some((c) => c.name === 'reese84');
    const summary = {
      url: page.url(),
      title: await page.title().catch(() => '(unavailable)'),
      hasReese84Cookie: hasReese84,
      cookieNames: cookies.map((c) => c.name),
      timestamp: new Date().toISOString(),
    };
    await writeFile(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
    notes.push(`page state: ${JSON.stringify(summary)}`);
  } catch (e) {
    notes.push(`state capture failed: ${e instanceof Error ? e.message : String(e)}`);
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

    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

    // Best-effort cookie-consent dismissal; non-fatal if absent (banner
    // preferences/domain behavior can vary and aren't load-bearing here).
    try {
      await page
        .frameLocator('iframe[title="SP Consent Message"]')
        .getByRole('button', { name: /accept/i })
        .click({ timeout: 5_000 });
    } catch {
      // No consent dialog shown — proceed.
    }

    await page.locator('input[name="Login"]').fill(username);
    await page.locator('input[name="Password"]').fill(password);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

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
      const notes = await captureDiagnostics(page, diagnosticsDir).catch((e: unknown) => [
        `diagnostics capture threw: ${e instanceof Error ? e.message : String(e)}`,
      ]);
      diagnosticsNote = notes.join('; ');
    }
    const original = err instanceof Error ? err.message : String(err);
    throw redactError(new Error(`${original} | ${diagnosticsNote}`), [username, password]);
  } finally {
    await browser.close();
  }
}
