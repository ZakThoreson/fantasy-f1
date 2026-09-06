import { loadLeagueHistory, loadLeagueStandings } from './api/loadData.js';
import { renderStandingsTable } from './render/standingsTable.js';
import { renderHistoryChart } from './render/historyChart.js';
import { renderPodium } from './render/podium.js';
import type { LeagueStandingsFile } from '@fantasy-f1/shared';

function renderError(message: string): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.replaceChildren();
  const p = document.createElement('p');
  p.className = 'error';
  p.textContent = message;
  app.append(p);
}

function renderPageHeader(data: LeagueStandingsFile): HTMLElement {
  const header = document.createElement('header');

  const heading = document.createElement('h1');
  heading.textContent = data.leagueName;
  header.append(heading);

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${data.entrantsCount} entrants · updated ${new Date(data.fetchedAt).toLocaleString()}`;
  header.append(meta);

  return header;
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

    const sections: HTMLElement[] = [renderPageHeader(standings)];

    const podium = renderPodium(standings, lastRacePoints);
    if (podium) sections.push(podium);

    if (history) {
      const chart = renderHistoryChart(history, standings);
      if (chart) sections.push(chart);
    }

    sections.push(renderStandingsTable(standings, lastRacePoints));

    app.replaceChildren(...sections);
  } catch (err) {
    console.error(err);
    renderError('Could not load league standings right now. Please try again later.');
  }
}

void init();
