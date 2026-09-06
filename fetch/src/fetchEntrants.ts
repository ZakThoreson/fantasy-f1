import { writeFile } from 'node:fs/promises';
import type { EntrantSummary, EntrantsFile } from '@fantasy-f1/shared';
import type { F1ApiClient } from './client.js';

interface RawEntrant {
  user_id: number | string;
  team_name: string;
  first_name: string;
  last_name: string;
  username: string | null;
}

interface RawLeagueEntrantsResponse {
  league_entrants: RawEntrant[];
}

function mapEntrant(raw: RawEntrant): EntrantSummary {
  return {
    userId: String(raw.user_id),
    teamName: raw.team_name,
    firstName: raw.first_name,
    lastName: raw.last_name,
    username: raw.username,
  };
}

export async function fetchLeagueEntrants(
  client: F1ApiClient,
  leagueId: string,
  outPath: string,
): Promise<void> {
  const raw = await client.getJson<RawLeagueEntrantsResponse>(
    `/league_entrants?league_id=${encodeURIComponent(leagueId)}`,
  );

  const file: EntrantsFile = {
    fetchedAt: new Date().toISOString(),
    leagueId,
    entrants: (raw.league_entrants ?? []).map(mapEntrant),
  };

  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
}
