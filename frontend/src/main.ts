import { loadLeagueStandings } from './api/loadData.js';
import { renderStandingsTable } from './render/standingsTable.js';

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
    const data = await loadLeagueStandings();
    app.replaceChildren(renderStandingsTable(data));
  } catch (err) {
    console.error(err);
    renderError('Could not load league standings right now. Please try again later.');
  }
}

void init();
