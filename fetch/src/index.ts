import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchLeagueStandings } from './fetchLeague.js';
import { fetchLeagueHistory } from './fetchHistory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

async function main(): Promise<void> {
  const leagueId = process.env.LEAGUE_ID ?? '4358307';
  const leagueName = process.env.LEAGUE_NAME ?? 'Fantasy F1 League';

  console.log(`Fetching data for league ${leagueId}...`);

  const tasks: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: 'league standings',
      run: () => fetchLeagueStandings(leagueId, leagueName, path.join(DATA_DIR, 'league.json')),
    },
    {
      name: 'league history',
      run: () => fetchLeagueHistory(leagueId, path.join(DATA_DIR, 'history.json')),
    },
  ];

  const results = await Promise.allSettled(tasks.map((t) => t.run()));

  let hadFailure = false;
  results.forEach((result, i) => {
    const name = tasks[i]?.name ?? 'unknown task';
    if (result.status === 'fulfilled') {
      console.log(`✓ Fetched ${name}`);
    } else {
      hadFailure = true;
      const reason = result.reason as unknown;
      console.error(
        `✗ Failed to fetch ${name}:`,
        reason instanceof Error ? reason.message : String(reason),
      );
    }
  });

  if (hadFailure) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
