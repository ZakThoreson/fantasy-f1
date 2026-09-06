import type { LeagueStandingsFile } from '@fantasy-f1/shared';

const ORDINALS = ['1st', '2nd', '3rd'];

/**
 * Top-3 summary cards. All text (team names) comes from other league
 * members and is rendered via textContent only — never innerHTML — same
 * rule as standingsTable.ts.
 */
export function renderPodium(
  data: LeagueStandingsFile,
  lastRacePoints: Map<string, number> | null,
): HTMLElement | null {
  const top3 = data.entrants.slice(0, 3);
  if (top3.length === 0) return null;

  const podium = document.createElement('section');
  podium.className = 'podium';

  top3.forEach((entrant, i) => {
    const card = document.createElement('div');
    card.className = `podium-card podium-${i + 1}`;

    const place = document.createElement('div');
    place.className = 'podium-place';
    place.textContent = ORDINALS[i] ?? `${i + 1}th`;
    card.append(place);

    const team = document.createElement('div');
    team.className = 'podium-team';
    team.textContent = entrant.teamName;
    card.append(team);

    const owner = document.createElement('div');
    owner.className = 'podium-owner';
    owner.textContent = entrant.firstName;
    card.append(owner);

    const points = document.createElement('div');
    points.className = 'podium-points';
    points.textContent = entrant.score.toLocaleString();
    card.append(points);

    const lastRace = lastRacePoints?.get(entrant.userId);
    if (lastRace !== undefined) {
      const delta = document.createElement('div');
      delta.className = `podium-delta ${lastRace >= 0 ? 'positive' : 'negative'}`;
      delta.textContent = `${lastRace >= 0 ? '+' : ''}${lastRace} last race`;
      card.append(delta);
    }

    podium.append(card);
  });

  return podium;
}
