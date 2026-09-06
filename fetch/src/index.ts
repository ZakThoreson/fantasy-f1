import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { fetchLeagueStandings } from './fetchLeague.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

async function main(): Promise<void> {
  const leagueId = process.env.LEAGUE_ID ?? '4358307';
  const leagueName = process.env.LEAGUE_NAME ?? 'Fantasy F1 League';

  console.log(`Fetching standings for league ${leagueId}...`);
  await fetchLeagueStandings(leagueId, leagueName, path.join(DATA_DIR, 'league.json'));
  console.log('✓ Fetched league standings');
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
