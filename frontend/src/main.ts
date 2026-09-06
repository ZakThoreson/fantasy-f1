import { loadLeagueHistory, loadLeagueStandings } from './api/loadData.js';
import { renderStandingsTable } from './render/standingsTable.js';
import { renderHistoryChart } from './render/historyChart.js';
import { renderPodium } from './render/podium.js';
import { formatRelativeTime, freshnessLevel } from './render/freshness.js';
import type { LeagueStandingsFile } from '@fantasy-f1/shared';

function renderError(message: string): void {
  const app = document.getElementById('app');
  if (!app) return;
  app.removeAttribute('aria-busy');
  app.replaceChildren();

  const card = document.createElement('div');
  card.className = 'error-card';
  card.setAttribute('role', 'alert');

  const icon = document.createElement('div');
  icon.className = 'error-icon';
  icon.textContent = '⚠';
  icon.setAttribute('aria-hidden', 'true');
  card.append(icon);

  const heading = document.createElement('h2');
  heading.textContent = 'Something went wrong';
  card.append(heading);

  const p = document.createElement('p');
  p.textContent = message;
  card.append(p);

  const retry = document.createElement('button');
  retry.type = 'button';
  retry.className = 'error-retry';
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => {
    window.location.reload();
  });
  card.append(retry);

  app.append(card);
}

function renderPageHeader(data: LeagueStandingsFile): HTMLElement {
  const header = document.createElement('header');

  const heading = document.createElement('h1');
  heading.textContent = data.leagueName;
  header.append(heading);

  const meta = document.createElement('p');
  meta.className = 'meta meta-freshness';

  const dot = document.createElement('span');
  dot.className = `freshness-dot freshness-${freshnessLevel(data.fetchedAt)}`;
  dot.setAttribute('aria-hidden', 'true');
  meta.append(dot);

  const text = document.createElement('span');
  text.textContent = `${data.entrantsCount} entrants · updated ${formatRelativeTime(data.fetchedAt)}`;
  text.title = new Date(data.fetchedAt).toLocaleString();
  meta.append(text);

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

    app.removeAttribute('aria-busy');
    app.replaceChildren(...sections);
  } catch (err) {
    console.error(err);
    renderError('Could not load league standings right now. Please try again later.');
  }
}

void init();
