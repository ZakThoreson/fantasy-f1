import { describe, expect, it } from 'vitest';
import { computeXF1CookieData } from '../src/cookieData.js';

describe('computeXF1CookieData', () => {
  it('matches a known-good fixture for a fixed subscription token', () => {
    // Fixture computed independently: base64(encodeURIComponent(JSON.stringify({ data: { subscriptionToken: 'abc123' } })))
    const expected =
      'JTdCJTIyZGF0YSUyMiUzQSU3QiUyMnN1YnNjcmlwdGlvblRva2VuJTIyJTNBJTIyYWJjMTIzJTIyJTdEJTdE';
    expect(computeXF1CookieData('abc123')).toBe(expected);
  });

  it('produces a value decodable back to the original token', () => {
    const token = 'some.jwt-like_token==';
    const encoded = computeXF1CookieData(token);
    const decoded = JSON.parse(decodeURIComponent(Buffer.from(encoded, 'base64').toString('utf8')));
    expect(decoded.data.subscriptionToken).toBe(token);
  });
});
