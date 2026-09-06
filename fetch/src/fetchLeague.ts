import { writeFile } from 'node:fs/promises';
import type { LeaderboardEntrant, LeagueStandingsFile } from '@fantasy-f1/shared';
import type { F1ApiClient } from './client.js';

interface RawEntrant {
  user_id: number | string;
  is_verified_entrant: boolean;
  user_country: string;
  score: number;
  team_name: string;
  rank: number;
  first_name: string;
  last_name: string;
  username: string | null;
  slot: number;
  overall_used_booster_ids: number[];
}

interface RawLeaderboardResponse {
  leaderboard: {
    entrants_count: number;
    league_name: string;
    max_points: number;
    min_points: number;
    leaderboard_entrants: RawEntrant[];
  };
}

function mapEntrant(raw: RawEntrant): LeaderboardEntrant {
  return {
    userId: String(raw.user_id),
    rank: raw.rank,
    score: raw.score,
    teamName: raw.team_name,
    firstName: raw.first_name,
    lastName: raw.last_name,
    username: raw.username,
    userCountry: raw.user_country,
    isVerifiedEntrant: raw.is_verified_entrant,
    slot: raw.slot,
    overallUsedBoosterIds: raw.overall_used_booster_ids ?? [],
  };
}

export async function fetchLeagueStandings(
  client: F1ApiClient,
  leagueId: string,
  outPath: string,
): Promise<void> {
  const raw = await client.getJson<RawLeaderboardResponse>(
    `/leaderboards/leagues?game_period_id=&league_id=${encodeURIComponent(leagueId)}`,
  );

  const file: LeagueStandingsFile = {
    fetchedAt: new Date().toISOString(),
    leagueId,
    leagueName: raw.leaderboard.league_name,
    entrantsCount: raw.leaderboard.entrants_count,
    maxPoints: raw.leaderboard.max_points,
    minPoints: raw.leaderboard.min_points,
    entrants: raw.leaderboard.leaderboard_entrants.map(mapEntrant).sort((a, b) => a.rank - b.rank),
  };

  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
}
