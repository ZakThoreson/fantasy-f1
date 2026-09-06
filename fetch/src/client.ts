const API_BASE = 'https://fantasy-api.formula1.com/partner_games/f1';

export class F1ApiClient {
  constructor(private readonly xF1CookieData: string) {}

  async getJson<T>(path: string): Promise<T> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, {
      headers: {
        'X-F1-Cookie-Data': this.xF1CookieData,
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      // Deliberately omit the response body: F1 error payloads have not been
      // audited for whether they could ever echo request data back.
      throw new Error(`F1 API request failed: ${res.status} ${res.statusText} (${path})`);
    }

    return (await res.json()) as T;
  }
}
