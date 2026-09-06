import { chromium } from 'playwright';
import { redactError } from './redact.js';

const LOGIN_URL =
  'https://account.formula1.com/#/en/login?redirect=https%3A%2F%2Ffantasy.formula1.com%2Fen&lead_source=web_fantasy';
const BY_PASSWORD_URL_PART = '/v2/account/subscriber/authenticate/by-password';
const NAV_TIMEOUT_MS = 30_000;
const RESPONSE_TIMEOUT_MS = 20_000;

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
export async function getSubscriptionToken(username: string, password: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
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
    throw redactError(err, [username, password]);
  } finally {
    await browser.close();
  }
}
