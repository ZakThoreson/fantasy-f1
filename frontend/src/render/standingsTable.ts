import type { LeagueStandingsFile } from '@fantasy-f1/shared';

/**
 * All entrant fields (team name, owner name) come from other league members
 * via F1's API and are rendered here with textContent only — never
 * innerHTML — so a malicious display name can't inject markup/scripts.
 */
export function renderStandingsTable(
  data: LeagueStandingsFile,
  lastRacePoints: Map<string, number> | null,
): HTMLElement {
  const container = document.createElement('section');

  const heading = document.createElement('h1');
  heading.textContent = data.leagueName;
  container.append(heading);

  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = `${data.entrantsCount} entrants · updated ${new Date(data.fetchedAt).toLocaleString()}`;
  container.append(meta);

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const columns = ['', 'Rank', 'Team', 'Owner', 'Score'];
  if (lastRacePoints) columns.push('Last Race');
  columns.push('Value');
  for (const label of columns) {
    const th = document.createElement('th');
    th.textContent = label;
    if (label === 'Score' || label === 'Last Race' || label === 'Value')
      th.classList.add('numeric');
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  for (const entrant of data.entrants) {
    const row = document.createElement('tr');

    const trendCell = document.createElement('td');
    trendCell.className = `trend trend-${entrant.trend > 0 ? 'up' : entrant.trend < 0 ? 'down' : 'flat'}`;
    trendCell.textContent = entrant.trend > 0 ? '▲' : entrant.trend < 0 ? '▼' : '–';
    row.append(trendCell);

    const rankCell = document.createElement('td');
    rankCell.textContent = String(entrant.rank);
    row.append(rankCell);

    const teamCell = document.createElement('td');
    teamCell.textContent = entrant.teamName;
    row.append(teamCell);

    const ownerCell = document.createElement('td');
    ownerCell.textContent = entrant.firstName;
    row.append(ownerCell);

    const scoreCell = document.createElement('td');
    scoreCell.className = 'numeric';
    scoreCell.textContent = String(entrant.score);
    row.append(scoreCell);

    if (lastRacePoints) {
      const lastRaceCell = document.createElement('td');
      lastRaceCell.className = 'numeric';
      const points = lastRacePoints.get(entrant.userId);
      lastRaceCell.textContent = points === undefined ? '—' : String(points);
      row.append(lastRaceCell);
    }

    const valueCell = document.createElement('td');
    valueCell.className = 'numeric';
    valueCell.textContent = `$${entrant.teamValue.toFixed(1)}M`;
    row.append(valueCell);

    tbody.append(row);
  }
  table.append(tbody);
  container.append(table);

  return container;
}
