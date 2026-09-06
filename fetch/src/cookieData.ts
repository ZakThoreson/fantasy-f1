/**
 * Computes the X-F1-Cookie-Data header value F1's fantasy-api expects on every
 * authenticated request, from the subscriptionToken returned by the
 * by-password login endpoint. Pure function, no I/O — see test/cookieData.test.ts.
 */
export function computeXF1CookieData(subscriptionToken: string): string {
  const payload = JSON.stringify({ data: { subscriptionToken } });
  return Buffer.from(encodeURIComponent(payload)).toString('base64');
}
