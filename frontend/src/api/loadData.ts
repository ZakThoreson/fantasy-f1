import type { LeagueStandingsFile } from '@fantasy-f1/shared';

export async function loadLeagueStandings(): Promise<LeagueStandingsFile> {
  const res = await fetch('./data/league.json');
  if (!res.ok) {
    throw new Error(`Failed to load league data: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as LeagueStandingsFile;

  if (!Array.isArray(data.entrants)) {
    throw new Error('League data is malformed: expected an "entrants" array.');
  }

  return data;
}
