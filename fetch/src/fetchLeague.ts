import { writeFile } from 'node:fs/promises';
import type { LeaderboardEntrant, LeagueStandingsFile } from '@fantasy-f1/shared';

interface RawEntrant {
  trend: number;
  cur_rank: number;
  social_id: string;
  team_name: string;
  user_name: string;
  cur_points: number;
}

interface RawFeedResponse {
  Value: {
    leaderboard: RawEntrant[];
  };
}

/** F1's feed URL-encodes team names (e.g. "Forza%20Cavallino%20Rampante"). */
export function decodeF1String(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** user_name is a full real name ("Zachary Thoreson") — see types.ts doc comment on why only the first name is kept. */
export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function mapEntrant(raw: RawEntrant): LeaderboardEntrant {
  return {
    userId: raw.social_id,
    rank: raw.cur_rank,
    score: raw.cur_points,
    teamName: decodeF1String(raw.team_name),
    firstName: firstNameOf(raw.user_name),
    trend: raw.trend,
  };
}

/**
 * F1 publishes each private league's standings as a static, publicly cached
 * CDN file — confirmed via a plain unauthenticated request (no cookies, no
 * headers) — presumably so leagues can be shared/embedded without every
 * viewer needing to log in. This is far simpler and more reliable than the
 * fantasy.formula1.com/services/... API discovered during development, which
 * needs a full browser-based login to reach (see git history on this file
 * for that approach, kept only as a design record — not used here).
 */
export async function fetchLeagueStandings(
  leagueId: string,
  leagueName: string,
  outPath: string,
): Promise<void> {
  const url = `https://fantasy.formula1.com/feeds/leaderboard/privateleague/list_1_${encodeURIComponent(leagueId)}_0_1.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`F1 leaderboard feed request failed: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as RawFeedResponse;
  const entrants = raw.Value.leaderboard.map(mapEntrant).sort((a, b) => a.rank - b.rank);
  const scores = entrants.map((e) => e.score);

  const file: LeagueStandingsFile = {
    fetchedAt: new Date().toISOString(),
    leagueId,
    leagueName,
    entrantsCount: entrants.length,
    maxPoints: scores.length > 0 ? Math.max(...scores) : 0,
    minPoints: scores.length > 0 ? Math.min(...scores) : 0,
    entrants,
  };

  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
}
