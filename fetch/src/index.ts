import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getSubscriptionToken } from './auth.js';
import { computeXF1CookieData } from './cookieData.js';
import { F1ApiClient } from './client.js';
import { fetchLeagueStandings } from './fetchLeague.js';
import { fetchLeagueEntrants } from './fetchEntrants.js';
import { fetchLeagueHistory } from './fetchHistory.js';
import { redactError } from './redact.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');

async function main(): Promise<void> {
  const username = process.env.F1_USERNAME;
  const password = process.env.F1_PASSWORD;
  const leagueId = process.env.LEAGUE_ID ?? '4358307';

  if (!username || !password) {
    throw new Error('F1_USERNAME and F1_PASSWORD environment variables are required.');
  }

  console.log(`Logging in to fetch data for league ${leagueId}...`);
  const subscriptionToken = await getSubscriptionToken(username, password);
  const xF1CookieData = computeXF1CookieData(subscriptionToken);
  const client = new F1ApiClient(xF1CookieData);

  const tasks: Array<{ name: string; run: () => Promise<void> }> = [
    {
      name: 'league standings',
      run: () => fetchLeagueStandings(client, leagueId, path.join(DATA_DIR, 'league.json')),
    },
    {
      name: 'league entrants',
      run: () => fetchLeagueEntrants(client, leagueId, path.join(DATA_DIR, 'entrants.json')),
    },
    {
      name: 'league history',
      run: () => fetchLeagueHistory(client, leagueId, 1, path.join(DATA_DIR, 'history.json')),
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
      console.error(
        `✗ Failed to fetch ${name}:`,
        redactError(result.reason, [username, password]).message,
      );
    }
  });

  if (hadFailure) {
    process.exitCode = 1;
  }
}

main().catch((err: unknown) => {
  const username = process.env.F1_USERNAME ?? '';
  const password = process.env.F1_PASSWORD ?? '';
  console.error(redactError(err, [username, password]).message);
  process.exitCode = 1;
});
