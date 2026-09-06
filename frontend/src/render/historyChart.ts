import type { HistoryFile, LeagueStandingsFile } from '@fantasy-f1/shared';

const SVG_NS = 'http://www.w3.org/2000/svg';
const CHART_WIDTH = 640;
const CHART_HEIGHT = 280;
const MARGIN = { top: 16, right: 16, bottom: 28, left: 44 };
const TOP_N_HIGHLIGHTED = 3;
// Categorical slots 1-3 from the dataviz skill's validated palette (blue,
// orange, aqua) — the only three that stay CVD-safe against each other under
// an all-pairs comparison. With 14 teams, coloring every line would fail that
// check entirely, so only the top 3 (by current rank) get color; the rest
// render as muted context lines. See references/palette.md in the dataviz skill.
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];

interface TeamSeries {
  userId: string;
  teamName: string;
  firstName: string;
  points: number[]; // cumulative, one per round, aligned to `rounds`
}

function buildSeries(
  history: HistoryFile,
  standings: LeagueStandingsFile,
): { rounds: number[]; series: TeamSeries[] } {
  const rounds = history.rounds.map((r) => r.round);
  const infoById = new Map(standings.entrants.map((e) => [e.userId, e]));
  const cumulativeByUser = new Map<string, number>();
  const seriesByUser = new Map<string, TeamSeries>();

  for (const round of history.rounds) {
    for (const entry of round.entrants) {
      const info = infoById.get(entry.userId);
      if (!info) continue; // a team not in current standings (shouldn't happen) — skip rather than crash

      const cumulative = (cumulativeByUser.get(entry.userId) ?? 0) + entry.points;
      cumulativeByUser.set(entry.userId, cumulative);

      let series = seriesByUser.get(entry.userId);
      if (!series) {
        series = {
          userId: entry.userId,
          teamName: info.teamName,
          firstName: info.firstName,
          points: [],
        };
        seriesByUser.set(entry.userId, series);
      }
      series.points.push(cumulative);
    }
  }

  // Order to match the standings table (current rank), so "top 3" agrees with it.
  const series = standings.entrants
    .map((e) => seriesByUser.get(e.userId))
    .filter((s): s is TeamSeries => s !== undefined);

  return { rounds, series };
}

function buildPath(
  points: number[],
  xForIndex: (i: number) => number,
  yForValue: (v: number) => number,
): string {
  return points
    .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xForIndex(i).toFixed(1)} ${yForValue(v).toFixed(1)}`)
    .join(' ');
}

/** Rounds a step to 1/2/5 × 10^n so axis ticks land on clean numbers (0 / 1,000 / 2,000), not raw fractions. */
function niceStep(roughStep: number): number {
  const exponent = Math.floor(Math.log10(roughStep));
  const magnitude = Math.pow(10, exponent);
  const fraction = roughStep / magnitude;
  const niceFraction = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  return niceFraction * magnitude;
}

/** Clean, evenly-spaced tick values covering [min, max], e.g. [0, 1000, 2000, 3000]. */
function niceTicks(min: number, max: number, targetCount: number): number[] {
  if (max <= min) return [min];
  const step = niceStep((max - min) / Math.max(1, targetCount - 1));
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step / 2; v += step) {
    ticks.push(v);
  }
  return ticks;
}

/** Returns null if there's not enough history yet to draw a meaningful line. */
export function renderHistoryChart(
  history: HistoryFile,
  standings: LeagueStandingsFile,
): HTMLElement | null {
  if (history.rounds.length < 2) return null;

  const { rounds, series } = buildSeries(history, standings);
  if (series.length === 0) return null;

  const allValues = series.flatMap((s) => s.points);
  const rawMax = Math.max(1, ...allValues);
  const rawMin = Math.min(0, ...allValues);
  const yTicks = niceTicks(rawMin, rawMax, 5);
  const minPoints = yTicks[0] ?? rawMin;
  const maxPoints = yTicks[yTicks.length - 1] ?? rawMax;

  const plotWidth = CHART_WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const xForIndex = (i: number): number =>
    MARGIN.left + (rounds.length === 1 ? 0 : (i / (rounds.length - 1)) * plotWidth);
  const yForValue = (v: number): number =>
    MARGIN.top + plotHeight - ((v - minPoints) / (maxPoints - minPoints || 1)) * plotHeight;

  const container = document.createElement('section');
  container.className = 'history-chart';

  const heading = document.createElement('h2');
  heading.textContent = 'Points over time';
  container.append(heading);

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  series.slice(0, TOP_N_HIGHLIGHTED).forEach((s, i) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    const swatch = document.createElement('span');
    swatch.className = 'legend-swatch';
    swatch.style.backgroundColor = SERIES_COLORS[i] ?? '#888';
    item.append(swatch);
    const label = document.createElement('span');
    label.textContent = s.teamName;
    item.append(label);
    legend.append(item);
  });
  const legendOther = document.createElement('span');
  legendOther.className = 'legend-item legend-other';
  const otherSwatch = document.createElement('span');
  otherSwatch.className = 'legend-swatch legend-swatch-muted';
  legendOther.append(otherSwatch);
  const otherLabel = document.createElement('span');
  otherLabel.textContent = 'Rest of the league (hover for details)';
  legendOther.append(otherLabel);
  legend.append(legendOther);
  container.append(legend);

  const chartWrap = document.createElement('div');
  chartWrap.className = 'history-chart-wrap';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    `Cumulative points by race, round ${String(rounds[0])} through round ${String(rounds[rounds.length - 1])}. Full values are in the table below.`,
  );
  svg.classList.add('history-svg');
  svg.setAttribute('tabindex', '0');

  // Gridlines + y-axis labels
  const gridGroup = document.createElementNS(SVG_NS, 'g');
  gridGroup.setAttribute('class', 'grid');
  for (const value of yTicks) {
    const y = yForValue(value);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(MARGIN.left));
    line.setAttribute('x2', String(CHART_WIDTH - MARGIN.right));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    gridGroup.append(line);

    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(MARGIN.left - 8));
    label.setAttribute('y', String(y));
    label.setAttribute('text-anchor', 'end');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('class', 'axis-label');
    label.textContent = Math.round(value).toLocaleString();
    gridGroup.append(label);
  }
  svg.append(gridGroup);

  // X-axis round labels: first, middle, last — avoids crowding with 13+ rounds.
  const xAxisGroup = document.createElementNS(SVG_NS, 'g');
  xAxisGroup.setAttribute('class', 'x-axis');
  const labelIndices = new Set([0, Math.floor((rounds.length - 1) / 2), rounds.length - 1]);
  labelIndices.forEach((i) => {
    const round = rounds[i];
    if (round === undefined) return;
    const label = document.createElementNS(SVG_NS, 'text');
    label.setAttribute('x', String(xForIndex(i)));
    label.setAttribute('y', String(CHART_HEIGHT - MARGIN.bottom + 18));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('class', 'axis-label');
    label.textContent = `R${round}`;
    xAxisGroup.append(label);
  });
  svg.append(xAxisGroup);

  // Context lines first (so highlighted lines draw on top), then highlighted lines + end markers.
  const linesGroup = document.createElementNS(SVG_NS, 'g');
  series.slice(TOP_N_HIGHLIGHTED).forEach((s) => {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', buildPath(s.points, xForIndex, yForValue));
    path.setAttribute('class', 'history-line history-line-muted');
    linesGroup.append(path);
  });
  series.slice(0, TOP_N_HIGHLIGHTED).forEach((s, i) => {
    const color = SERIES_COLORS[i] ?? '#888';
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', buildPath(s.points, xForIndex, yForValue));
    path.setAttribute('class', 'history-line');
    path.setAttribute('stroke', color);
    linesGroup.append(path);

    const lastIndex = s.points.length - 1;
    const lastValue = s.points[lastIndex];
    if (lastValue === undefined) return;
    const dot = document.createElementNS(SVG_NS, 'circle');
    dot.setAttribute('cx', String(xForIndex(lastIndex)));
    dot.setAttribute('cy', String(yForValue(lastValue)));
    dot.setAttribute('r', '4');
    dot.setAttribute('class', 'history-dot');
    dot.setAttribute('fill', color);
    linesGroup.append(dot);
  });
  svg.append(linesGroup);

  // Crosshair (hidden until hover/focus)
  const crosshair = document.createElementNS(SVG_NS, 'line');
  crosshair.setAttribute('class', 'crosshair');
  crosshair.setAttribute('y1', String(MARGIN.top));
  crosshair.setAttribute('y2', String(CHART_HEIGHT - MARGIN.bottom));
  crosshair.setAttribute('visibility', 'hidden');
  svg.append(crosshair);

  chartWrap.append(svg);

  const tooltip = document.createElement('div');
  tooltip.className = 'chart-tooltip';
  tooltip.hidden = true;
  chartWrap.append(tooltip);

  function showRound(index: number, pointerX: number, pointerY: number): void {
    const round = rounds[index];
    if (round === undefined) return;

    crosshair.setAttribute('x1', String(xForIndex(index)));
    crosshair.setAttribute('x2', String(xForIndex(index)));
    crosshair.setAttribute('visibility', 'visible');

    const rowsAtRound = series
      .map((s, seriesIndex) => ({
        teamName: s.teamName,
        value: s.points[index],
        color: seriesIndex < TOP_N_HIGHLIGHTED ? SERIES_COLORS[seriesIndex] : undefined,
      }))
      .filter(
        (r): r is { teamName: string; value: number; color: string | undefined } =>
          r.value !== undefined,
      )
      .sort((a, b) => b.value - a.value);

    tooltip.replaceChildren();
    const title = document.createElement('div');
    title.className = 'chart-tooltip-title';
    title.textContent = `Round ${round}`;
    tooltip.append(title);

    for (const row of rowsAtRound) {
      const rowEl = document.createElement('div');
      rowEl.className = 'chart-tooltip-row';

      const key = document.createElement('span');
      key.className = 'chart-tooltip-key';
      key.style.backgroundColor = row.color ?? 'var(--muted)';
      rowEl.append(key);

      const name = document.createElement('span');
      name.className = 'chart-tooltip-name';
      name.textContent = row.teamName;
      rowEl.append(name);

      const value = document.createElement('span');
      value.className = 'chart-tooltip-value';
      value.textContent = row.value.toLocaleString();
      rowEl.append(value);

      tooltip.append(rowEl);
    }

    tooltip.hidden = false;
    const wrapRect = chartWrap.getBoundingClientRect();
    const left = Math.min(Math.max(pointerX - wrapRect.left + 12, 0), wrapRect.width - 200);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${Math.max(pointerY - wrapRect.top - 12, 0)}px`;
  }

  function hideTooltip(): void {
    tooltip.hidden = true;
    crosshair.setAttribute('visibility', 'hidden');
  }

  function nearestIndexForClientX(clientX: number): number {
    const rect = svg.getBoundingClientRect();
    const svgX = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    let closest = 0;
    let closestDistance = Infinity;
    rounds.forEach((_, i) => {
      const distance = Math.abs(xForIndex(i) - svgX);
      if (distance < closestDistance) {
        closestDistance = distance;
        closest = i;
      }
    });
    return closest;
  }

  svg.addEventListener('pointermove', (event) => {
    showRound(nearestIndexForClientX(event.clientX), event.clientX, event.clientY);
  });
  svg.addEventListener('pointerleave', hideTooltip);

  // Keyboard equivalent: focus the chart, arrow through rounds.
  let focusedIndex = rounds.length - 1;
  svg.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      focusedIndex = Math.max(0, focusedIndex - 1);
    } else if (event.key === 'ArrowRight') {
      focusedIndex = Math.min(rounds.length - 1, focusedIndex + 1);
    } else {
      return;
    }
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const x = rect.left + (xForIndex(focusedIndex) / CHART_WIDTH) * rect.width;
    showRound(focusedIndex, x, rect.top + rect.height / 2);
  });
  svg.addEventListener('blur', hideTooltip);

  container.append(chartWrap);

  container.append(buildFullDataTable(rounds, series));

  return container;
}

/**
 * The accessible, hover-free twin of the chart — every round-by-round value
 * for every team, not just the top 3 the chart highlights. Collapsed by
 * default since it's large (rounds × teams), but always reachable.
 */
function buildFullDataTable(rounds: number[], series: TeamSeries[]): HTMLElement {
  const details = document.createElement('details');
  details.className = 'history-table-details';

  const summary = document.createElement('summary');
  summary.textContent = 'Show full round-by-round data';
  details.append(summary);

  const scrollWrap = document.createElement('div');
  scrollWrap.className = 'history-table-wrap';

  const table = document.createElement('table');
  table.className = 'history-table';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const roundHeader = document.createElement('th');
  roundHeader.textContent = 'Round';
  headRow.append(roundHeader);
  for (const s of series) {
    const th = document.createElement('th');
    th.textContent = s.teamName;
    headRow.append(th);
  }
  thead.append(headRow);
  table.append(thead);

  const tbody = document.createElement('tbody');
  rounds.forEach((round, i) => {
    const row = document.createElement('tr');
    const roundCell = document.createElement('td');
    roundCell.textContent = `R${round}`;
    row.append(roundCell);
    for (const s of series) {
      const cell = document.createElement('td');
      const value = s.points[i];
      cell.textContent = value === undefined ? '—' : value.toLocaleString();
      row.append(cell);
    }
    tbody.append(row);
  });
  table.append(tbody);

  scrollWrap.append(table);
  details.append(scrollWrap);
  return details;
}
