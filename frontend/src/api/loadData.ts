import type { HistoryFile, LeagueStandingsFile } from '@fantasy-f1/shared';

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

/**
 * History is a nice-to-have (the race-over-race chart), not core to the page,
 * so a missing/malformed file returns null rather than failing the whole
 * render — the standings table still works without it.
 */
export async function loadLeagueHistory(): Promise<HistoryFile | null> {
  try {
    const res = await fetch('./data/history.json');
    if (!res.ok) return null;

    const data = (await res.json()) as HistoryFile;
    if (!Array.isArray(data.rounds)) return null;

    return data;
  } catch {
    return null;
  }
}
