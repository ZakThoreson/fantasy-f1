/**
 * Shared data contract between the `fetch` package (writer, runs in CI) and the
 * `frontend` package (reader, runs in the browser). This shape is OUR OWN clean
 * schema, remapped from F1's public leaderboard feed by the fetch package — the
 * frontend should never need to know about F1's raw field names.
 *
 * Deliberately excludes last names: this site is public, and F1's private
 * leagues are normally only visible to logged-in league members. First name +
 * team name is enough to be recognizable within the league without publishing
 * a league mate's full real name to the open internet.
 */

export interface LeaderboardEntrant {
  userId: string;
  rank: number;
  score: number;
  teamName: string;
  firstName: string;
  /** -1, 0, or 1 — rank movement since the feed's previous update. */
  trend: number;
}

export interface LeagueStandingsFile {
  fetchedAt: string;
  leagueId: string;
  leagueName: string;
  entrantsCount: number;
  maxPoints: number;
  minPoints: number;
  entrants: LeaderboardEntrant[];
}

/**
 * Per-race points (not cumulative — can be negative) for every entrant, one
 * entry per race F1 has published a feed for so far this season. F1 exposes
 * this the same way it exposes current standings: a public, unauthenticated
 * feed at .../list_2_{leagueId}_{round}_1.json, one static file per round.
 * Team/owner names aren't repeated here — join on userId against
 * LeagueStandingsFile.entrants, which already has them.
 */
export interface HistoryRoundEntry {
  userId: string;
  points: number;
}

export interface HistoryRound {
  round: number;
  entrants: HistoryRoundEntry[];
}

export interface HistoryFile {
  fetchedAt: string;
  leagueId: string;
  /** Ascending by round number. */
  rounds: HistoryRound[];
}
