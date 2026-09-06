import { writeFile } from 'node:fs/promises';
import type { HistoryFile } from '@fantasy-f1/shared';
import type { F1ApiClient } from './client.js';

/**
 * The real response shape of this endpoint is unconfirmed (see
 * shared/src/types.ts HistoryFile doc comment) — this stores the raw response
 * rather than mapping into a guessed schema. `slot` appears (per the public
 * leaderboard response) to identify a specific fantasy team a user owns;
 * slot 1 is the default/primary team.
 */
export async function fetchLeagueHistory(
  client: F1ApiClient,
  leagueId: string,
  slot: number,
  outPath: string,
): Promise<void> {
  const raw = await client.getJson<unknown>(
    `/leaderboards/league/history?league_id=${encodeURIComponent(leagueId)}&slot=${slot}&type=league`,
  );

  const file: HistoryFile = {
    fetchedAt: new Date().toISOString(),
    leagueId,
    schemaNote:
      'Raw, unmapped F1 API response — schema not yet confirmed. See shared/src/types.ts HistoryFile.',
    raw,
  };

  await writeFile(outPath, JSON.stringify(file, null, 2) + '\n', 'utf8');
}
