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
