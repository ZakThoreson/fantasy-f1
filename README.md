# Fantasy F1 League Tracker

A small static site that tracks standings for a private [F1 Fantasy](https://fantasy.formula1.com/) league, hosted on GitHub Pages and kept up to date automatically by a scheduled GitHub Actions workflow.

## Disclaimer

This project reads an **unofficial, publicly accessible F1 Fantasy data feed** and is not affiliated with, endorsed by, or supported by Formula 1, the FIA, or F1 Fantasy. It may stop working at any time if F1 changes or removes that feed. Use at your own risk; not for commercial use.

## Architecture

```
fetch/  (Node, runs in CI or locally — a single plain HTTP request)
   │  reads F1's public leaderboard feed, writes JSON
   ▼
data/league.json  (committed to the repo)
   │  copied into frontend/public/data/ at build time
   ▼
frontend/  (static TypeScript + Vite site)
   │  fetches ./data/league.json at runtime, renders a standings table
   ▼
GitHub Pages
```

- **`shared/`** — TypeScript types describing `data/league.json`'s schema. Both `fetch` (the writer) and `frontend` (the reader) import from here, so the two sides of the contract can't drift apart.
- **`fetch/`** — a small Node script that fetches and reshapes F1's public leaderboard feed. No credentials, no browser, no login of any kind.
- **`frontend/`** — a plain TypeScript + Vite site with no UI framework. The whole app is one standings table, so a framework wouldn't add much; the interesting parts are strict TypeScript, a clean fetch/render split, and secure DOM handling (see below).
- **`data/`** — the committed JSON snapshot. The frontend fetches it at runtime rather than having it inlined at build time, so a data-only commit updates what's shown on next page load even if a redeploy is ever delayed.

## How data fetching actually works

F1 publishes each private league's current standings as a static, publicly cached file:

```
https://fantasy.formula1.com/feeds/leaderboard/privateleague/list_1_{leagueId}_0_1.json
```

No login, cookies, or headers of any kind are required — this was confirmed with a plain `curl` request. It's served off S3/CloudFront alongside F1's other public reference feeds (schedules, driver lists), presumably so a league's standings can be shared or embedded without every viewer needing an F1 account. `fetch/src/fetchLeague.ts` just requests that URL and remaps the response into our own clean schema.

This is deliberately much simpler than it first appears it needs to be. F1's actual authenticated API (`fantasy.formula1.com/services/...`) sits behind Akamai Bot Manager and requires a full browser-driven login to reach — that path was built, debugged, and made to work during this project's development, but was removed once this public feed was discovered, since it gives the same standings data with no credentials, no bot-detection fragility, and nothing to keep secret. (It only lacks per-gameweek history, which the authenticated API could provide — not implemented here.)

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev -w frontend      # serves the frontend against whatever is in frontend/public/data
```

To run the data-fetching script locally:

```bash
npm run fetch -w fetch
cp data/league.json frontend/public/data/
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

- **`update-data.yml`** — re-fetches league data every 6 hours, plus on manual trigger. Commits `data/league.json` only if something actually changed.
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

- **This depends on an undocumented public feed that could change or disappear without notice.** F1 doesn't publish this as a supported integration point; a red `update-data.yml` run means that URL's shape or availability changed, not necessarily a bug in this repo.
- **No per-gameweek history.** The public feed only exposes current cumulative standings. A history/trend view would require reintroducing F1's authenticated API and the Akamai-login automation this project intentionally moved away from.
