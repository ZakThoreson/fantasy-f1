import type { LeagueStandingsFile } from '@fantasy-f1/shared';

/**
 * All entrant fields (team name, owner name, username) come from other league
 * members via F1's API and are rendered here with textContent only — never
 * innerHTML — so a malicious display name can't inject markup/scripts.
 */
export function renderStandingsTable(data: LeagueStandingsFile): HTMLElement {
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
  for (const label of ['Rank', 'Team', 'Owner', 'Score']) {
    const th = document.createElement('th');
    th.textContent = label;
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  for (const entrant of data.entrants) {
    const row = document.createElement('tr');

    const rankCell = document.createElement('td');
    rankCell.textContent = String(entrant.rank);
    row.append(rankCell);

    const teamCell = document.createElement('td');
    teamCell.textContent = entrant.teamName;
    row.append(teamCell);

    const ownerCell = document.createElement('td');
    const ownerName = [entrant.firstName, entrant.lastName].filter(Boolean).join(' ');
    ownerCell.textContent = entrant.username ? `${ownerName} (@${entrant.username})` : ownerName;
    row.append(ownerCell);

    const scoreCell = document.createElement('td');
    scoreCell.textContent = String(entrant.score);
    row.append(scoreCell);

    tbody.append(row);
  }
  table.append(tbody);
  container.append(table);

  return container;
}
