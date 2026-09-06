# Fantasy F1 League Tracker

A small static site that tracks standings for a private [F1 Fantasy](https://fantasy.formula1.com/) league, hosted on GitHub Pages and kept up to date automatically by a scheduled GitHub Actions workflow.

## Disclaimer

This project reads an **unofficial, publicly accessible F1 Fantasy data feed** and is not affiliated with, endorsed by, or supported by Formula 1, the FIA, or F1 Fantasy. It may stop working at any time if F1 changes or removes that feed. Use at your own risk; not for commercial use.

## Architecture

```
fetch/  (Node, runs in CI or locally — plain HTTP requests, no auth)
   │  reads F1's public leaderboard + per-race feeds, writes JSON
   ▼
data/{league,history}.json  (committed to the repo)
   │  copied into frontend/public/data/ at build time
   ▼
frontend/  (static TypeScript + Vite site)
   │  fetches ./data/*.json at runtime, renders a table + a line chart
   ▼
GitHub Pages
```

- **`shared/`** — TypeScript types describing `data/*.json`'s schema. Both `fetch` (the writer) and `frontend` (the reader) import from here, so the two sides of the contract can't drift apart.
- **`fetch/`** — a small Node script that fetches and reshapes F1's public feeds. No credentials, no browser, no login of any kind.
- **`frontend/`** — a plain TypeScript + Vite site with no UI framework. The interesting parts are strict TypeScript, a clean fetch/render split, secure DOM handling (see below), and a hand-built SVG chart following an emphasis-color pattern (a few teams highlighted, the rest as context) rather than a charting library.
- **`data/`** — the committed JSON snapshots. The frontend fetches them at runtime rather than having them inlined at build time, so a data-only commit updates what's shown on next page load even if a redeploy is ever delayed.

## How data fetching actually works

F1 publishes each private league's standings as static, publicly cached files — both the current cumulative totals and, less obviously, **each individual race's results**:

```
https://fantasy.formula1.com/feeds/leaderboard/privateleague/list_1_{leagueId}_0_1.json         # current standings
https://fantasy.formula1.com/feeds/leaderboard/privateleague/list_2_{leagueId}_{round}_1.json    # one race's results
https://fantasy.formula1.com/feeds/drivers/{round}_en.json                                       # driver + constructor prices for that round
```

No login, cookies, or headers of any kind are required for any of these — confirmed with plain `curl` requests. They're served off S3/CloudFront alongside F1's other public reference feeds (schedules, driver lists), presumably so a league's standings can be shared or embedded without every viewer needing an F1 account. `fetch/src/fetchLeague.ts` reads the first and the third (to compute each entrant's "Value" — the combined current price of their 5 drivers + 2 constructors); `fetch/src/fetchHistory.ts` probes `{round}` starting at 1 until a round 404s (i.e. that race hasn't happened yet) and reshapes every result found into `data/history.json`, which the frontend turns into cumulative point totals for the race-over-race chart.

The drivers feed has one quirk the others don't: an upcoming round's file can already exist with a 200 status but an _empty_ value array, rather than 404ing like the leaderboard feeds do. `fetchPlayerPrices.ts` treats an empty response the same as "doesn't exist yet" — otherwise the last real round's prices would get silently overwritten with nothing.

This is deliberately much simpler than it first appears it needs to be. F1's actual authenticated API (`fantasy.formula1.com/services/...`) sits behind Akamai Bot Manager and requires a full browser-driven login to reach — that path was built, debugged, and made to work during this project's development, but was removed once these public feeds were discovered, since they give the same data with no credentials, no bot-detection fragility, and nothing to keep secret.

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev -w frontend      # serves the frontend against whatever is in frontend/public/data
```

To run the data-fetching script locally:

```bash
npm run fetch -w fetch
cp data/*.json frontend/public/data/
```

No credentials or `.env` file needed — optionally set `LEAGUE_ID` / `LEAGUE_NAME` env vars to point at a different league.

Other useful commands (all run from the repo root, across all workspaces):

```bash
npm run lint
npm run format          # check formatting
npm run format:write    # fix formatting
npm run typecheck
npm test                # runs fetch's unit tests
```

## Deployment

Two GitHub Actions workflows do the work:

- **`update-data.yml`** — re-fetches league data every 6 hours, plus on manual trigger. Commits `data/*.json` only if something actually changed.
- **`deploy.yml`** — builds the frontend and deploys to GitHub Pages whenever `frontend/`, `data/`, or `shared/` change on `main` (so a data-only commit from the workflow above triggers a redeploy automatically).

### One-time setup (GitHub UI)

1. **Settings → Pages** — set "Build and deployment" source to **GitHub Actions**.
2. **Settings → Code security and analysis** — enable Dependabot alerts, Dependabot security updates, and secret scanning + push protection (free for public repos).
3. After the first successful `update-data.yml` and `deploy.yml` runs, open the Pages URL and confirm real data renders.
4. (Optional) Add branch protection on `main` requiring the `CI` check to pass before merging.

No repository secrets are required — the data source needs no authentication.

## Security notes

- No credentials of any kind are used, stored, or transmitted anywhere in this project.
- All league-member-supplied text (team names, first names) is rendered via `textContent`/`createElement`, never `innerHTML` — enforced by an ESLint rule — to prevent stored XSS via a malicious display name. A `Content-Security-Policy` meta tag adds defense-in-depth (GitHub Pages can't set real CSP response headers).
- Last names are deliberately dropped from the published data (see the doc comment on `LeaderboardEntrant` in `shared/src/types.ts`): F1's private leagues are normally visible only to logged-in members, and this site is public, so only first name + team name is published — enough to be recognizable within the league without publishing a league mate's full real name to the open internet.
- GitHub Actions workflows use least-privilege `permissions:` blocks, and third-party actions are pinned to a full commit SHA (kept current by Dependabot).
- Data-update commits are made as `github-actions[bot]`, not a personal access token.

## Known limitations

- **This depends on undocumented public feeds that could change or disappear without notice.** F1 doesn't publish these as a supported integration point; a red `update-data.yml` run means a feed's shape, URL pattern, or availability changed, not necessarily a bug in this repo.
- **History only covers races F1's feed has published so far** — there's no way to backfill data from before this project started reading it if a round's feed is ever taken down, and a season with more rounds than `fetchHistory.ts`'s probe cap (currently 30) would need that constant raised.
