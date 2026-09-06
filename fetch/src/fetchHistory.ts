import { writeFile } from 'node:fs/promises';
import type { HistoryFile, HistoryRound, HistoryRoundEntry } from '@fantasy-f1/shared';

interface RawRoundEntrant {
  social_id: string;
  cur_points: number;
}

interface RawRoundResponse {
  Value: {
    leaderboard: RawRoundEntrant[];
  };
}

// A full F1 season is well under this; generous cap so a season-length
// schedule change doesn't silently truncate history.
const MAX_ROUNDS_TO_PROBE = 30;

/**
 * F1 publishes each race's per-round standings the same way it publishes
 * current standings: a static, public feed (list_2_{leagueId}_{round}_1.json
 * — "2" selects the per-round view, vs "1" for cumulative). Confirmed via a
 * plain unauthenticated request. A round that hasn't happened yet 403s, which
 * is how we know where the season currently stands — no separate schedule
 * lookup needed.
 */
async function fetchRound(leagueId: string, round: number): Promise<HistoryRoundEntry[] | null> {
  const url = `https://fantasy.formula1.com/feeds/leaderboard/privateleague/list_2_${encodeURIComponent(leagueId)}_${round}_1.json`;
  const res = await fetch(url);
  if (!res.ok) return null;

  const raw = (await res.json()) as RawRoundResponse;
  return raw.Value.leaderboard.map((e) => ({ userId: e.social_id, points: e.cur_points }));
}

export async function fetchLeagueHistory(leagueId: string, outPath: string): Promise<void> {
  const rounds: HistoryRound[] = [];

  for (let round = 1; round <= MAX_ROUNDS_TO_PROBE; round++) {
    const entrants = await fetchRound(leagueId, round);
    if (!entrants) break;
    rounds.push({ round, entrants });
  }

  const file: HistoryFile = {
    fetchedAt: new Date().toISOString(),
    leagueId,
    rounds,
  };

  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
}
