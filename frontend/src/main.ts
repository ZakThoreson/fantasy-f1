import { loadLeagueHistory, loadLeagueStandings } from './api/loadData.js';
import { renderStandingsTable } from './render/standingsTable.js';
import { renderHistoryChart } from './render/historyChart.js';

function renderError(message: string): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.replaceChildren();
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = message;
  app.append(p);
}

async function init(): Promise<void> {
  const app = document.getElementById('app');
  if (!app) return;

  try {
    const [standings, history] = await Promise.all([loadLeagueStandings(), loadLeagueHistory()]);

    const lastRound = history?.rounds.at(-1);
    const lastRacePoints = lastRound
      ? new Map(lastRound.entrants.map((e) => [e.userId, e.points]))
      : null;

    app.replaceChildren(renderStandingsTable(standings, lastRacePoints));

    if (history) {
      const chart = renderHistoryChart(history, standings);
      if (chart) app.append(chart);
    }
  } catch (err) {
    console.error(err);
    renderError('Could not load league standings right now. Please try again later.');
  }
}

void init();
