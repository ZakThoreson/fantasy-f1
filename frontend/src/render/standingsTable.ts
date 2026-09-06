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
  container.className = 'standings-section';

  const heading = document.createElement('h2');
  heading.textContent = 'Standings';
  container.append(heading);

  // Wrapped for horizontal scroll on narrow screens — up to 7 columns is too
  // tight to shrink to a phone width without either scroll or dropping data.
  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'standings-table-wrap';

  const table = document.createElement('table');
  table.className = 'standings-table';
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
  scrollWrap.append(table);
  container.append(scrollWrap);

  const valueNote = document.createElement('p');
  valueNote.className = 'meta value-note';
  valueNote.textContent =
    'Value is each team\'s current roster price (5 drivers + 2 constructors), not what it cost to build — it rises as good picks appreciate over the season, and can jump well past the normal budget cap in a week a team plays F1 Fantasy\'s "Limitless" chip.';
  container.append(valueNote);

  return container;
}
