/**
 * Shared data contract between the `fetch` package (writer, runs in CI) and the
 * `frontend` package (reader, runs in the browser). These shapes are OUR OWN
 * clean schema, remapped from F1's undocumented API response by the fetch
 * package — the frontend should never need to know about F1's raw field names.
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
  username: string | null;
  userCountry: string;
  isVerifiedEntrant: boolean;
  slot: number;
  overallUsedBoosterIds: number[];
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

export interface EntrantSummary {
  userId: string;
  teamName: string;
  firstName: string;
  username: string | null;
}

export interface EntrantsFile {
  fetchedAt: string;
  leagueId: string;
  entrants: EntrantSummary[];
}

/**
 * The real shape of F1's `/leaderboards/league/history` response could not be
 * confirmed at implementation time (it requires an authenticated call this
 * project's automation couldn't make without real league credentials on hand).
 * Rather than guess a schema and risk silently mis-mapping fields, the fetch
 * package stores the raw response verbatim under `raw`. The frontend does not
 * currently render this file — wiring up a history/trend view is a follow-up
 * once the shape is inspected and a proper mapper (mirroring fetchLeague.ts)
 * can be written.
 */
export interface HistoryFile {
  fetchedAt: string;
  leagueId: string;
  schemaNote: string;
  raw: unknown;
}
