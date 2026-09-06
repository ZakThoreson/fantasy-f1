// A full F1 season is well under this; matches fetchHistory.ts's cap.
const MAX_ROUNDS_TO_PROBE = 30;

interface RawPlayer {
  PlayerId: string;
  Value: number;
}

interface RawPlayersResponse {
  Data: {
    Value: RawPlayer[];
  };
}

/**
 * Driver and constructor fantasy prices, published the same way as the
 * leaderboard feeds: a static public file per round
 * (feeds/drivers/{round}_en.json — "drivers" despite also including
 * constructors, distinguished by PositionName: DRIVER vs CONSTRUCTOR).
 * Prices genuinely change round to round (confirmed: a driver's price
 * differed across rounds 1, 12, and 13 of the 2026 season), so this probes
 * ascending the same way fetchHistory.ts does, keeping whichever round was
 * most recently available — i.e. current prices.
 */
export async function fetchLatestPlayerPrices(): Promise<Map<string, number>> {
  let prices: Map<string, number> | null = null;

  for (let round = 1; round <= MAX_ROUNDS_TO_PROBE; round++) {
    const res = await fetch(`https://fantasy.formula1.com/feeds/drivers/${round}_en.json`);
    if (!res.ok) break;

    const raw = (await res.json()) as RawPlayersResponse;
    // Unlike the leaderboard feed (which 403s past the current round), an
    // upcoming round's price file can already exist with a 200 but an empty
    // Data.Value — confirmed on this season's round 14. Treat that the same
    // as "doesn't exist yet" rather than overwriting real data with nothing.
    if (raw.Data.Value.length === 0) break;
    prices = new Map(raw.Data.Value.map((p) => [p.PlayerId, p.Value]));
  }

  if (!prices) {
    throw new Error('Could not find any published driver/constructor price feed.');
  }

  return prices;
}
