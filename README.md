# Fantasy F1 League Tracker

A small static site that tracks standings for a private [F1 Fantasy](https://fantasy.formula1.com/) league, hosted on GitHub Pages and kept up to date automatically by a scheduled GitHub Actions workflow.

## Disclaimer

This project uses an **unofficial, reverse-engineered F1 Fantasy API** and is not affiliated with, endorsed by, or supported by Formula 1, the FIA, or F1 Fantasy. It may stop working at any time if F1 changes their login flow, bot-detection, or API. Use at your own risk; not for commercial use.

## Architecture

```
fetch/  (Node + Playwright, runs only in CI)
   │  logs in, calls F1's fantasy API, writes JSON
   ▼
data/*.json  (committed to the repo)
   │  copied into frontend/public/data/ at build time
   ▼
frontend/  (static TypeScript + Vite site)
   │  fetches ./data/*.json at runtime, renders a standings table
   ▼
GitHub Pages
```

- **`shared/`** — TypeScript types describing the `data/*.json` schema. Both `fetch` (the writer) and `frontend` (the reader) import from here, so the two sides of the contract can't drift apart.
- **`fetch/`** — Node/Playwright script, run only inside GitHub Actions (or locally with your own `.env`). Never runs in the browser.
- **`frontend/`** — A plain TypeScript + Vite site with no UI framework. The whole app is one standings table, so a framework wouldn't add much; the interesting parts are strict TypeScript, a clean fetch/render split, and secure DOM handling (see below).
- **`data/`** — Committed JSON snapshots. The frontend fetches these at runtime rather than having them inlined at build time, so a data-only commit updates what's shown on next page load even if a redeploy is ever delayed.

## How the F1 auth flow works

F1's fantasy API sits behind Akamai Bot Manager. Logging in requires a `reese84` anti-bot cookie that can only be produced by real browser execution of Akamai's sensor JavaScript — there's no way to construct it by hand. So `fetch/src/auth.ts` drives a real headless Chromium browser (via Playwright) through F1's actual login page, lets the page's own JavaScript do its thing, and intercepts the network response from the login endpoint to read out a `subscriptionToken`. That token is turned into an `X-F1-Cookie-Data` header (a base64-encoded JSON blob) which authenticates every subsequent API call — made with a plain `fetch()`, no browser needed for those.

This is inherently fragile: if F1 changes their login page markup or Akamai changes its detection, `auth.ts` will likely need updating. See [Known limitations](#known-limitations).

## Local development

Requires Node.js 22+.

```bash
npm install
npm run dev -w frontend      # serves the frontend against whatever is in frontend/public/data
```

To run the data-fetching script locally (against the real F1 API):

```bash
cp .env.example .env         # fill in F1_USERNAME, F1_PASSWORD, LEAGUE_ID — never commit .env
npx playwright install chromium
npm run fetch -w fetch
cp data/*.json frontend/public/data/
```

Other useful commands (all run from the repo root, across all workspaces):

```bash
npm run lint
npm run format          # check formatting
npm run format:write    # fix formatting
npm run typecheck
npm test                # runs fetch's unit tests (pure functions only — no network/secrets)
```

## Deployment

Two GitHub Actions workflows do the work:

- **`update-data.yml`** — logs in and re-fetches league data a few times across Fri/Sat/Sun UTC (when races typically happen), plus on manual trigger. Commits `data/*.json` only if something actually changed.
- **`deploy.yml`** — builds the frontend and deploys to GitHub Pages whenever `frontend/`, `data/`, or `shared/` change on `main` (so a data-only commit from the workflow above triggers a redeploy automatically).

### One-time setup (GitHub UI)

1. **Settings → Secrets and variables → Actions** — add repository secrets `F1_USERNAME` and `F1_PASSWORD`.
2. **Settings → Pages** — set "Build and deployment" source to **GitHub Actions**.
3. **Settings → Code security and analysis** — enable Dependabot alerts, Dependabot security updates, and secret scanning + push protection (free for public repos).
4. After the first successful `update-data.yml` and `deploy.yml` runs, open the Pages URL and confirm real data renders.
5. (Optional) Add branch protection on `main` requiring the `CI` check to pass before merging.

## Security notes

- Credentials only ever live in GitHub Actions encrypted secrets or a local, gitignored `.env` — never in chat, code, or commit history.
- Errors from the login flow are scrubbed of credential values (`fetch/src/redact.ts`) before being logged, since this repo's Actions logs are public.
- All league-member-supplied text (team names, usernames, real names) is rendered via `textContent`/`createElement`, never `innerHTML` — enforced by an ESLint rule — to prevent stored XSS via a malicious display name. A `Content-Security-Policy` meta tag adds defense-in-depth (GitHub Pages can't set real CSP response headers).
- GitHub Actions workflows use least-privilege `permissions:` blocks, and third-party actions are pinned to a full commit SHA (kept current by Dependabot).
- Data-update commits are made as `github-actions[bot]`, not a personal access token.

## Known limitations

- **Login automation is fragile by design.** It depends on F1's current login page markup and Akamai's current bot-detection behavior, neither of which is documented or stable. A red `update-data.yml` run doesn't necessarily mean anything is broken in this repo — it may mean F1 changed something upstream.
- **The scheduled cron is a best-effort approximation of race weekends**, not a real F1 calendar. It fires several times every Friday, Saturday, and Sunday (UTC) regardless of whether a race is actually happening; extra runs are harmless since the commit step is a no-op when data hasn't changed.
- **`data/history.json` is currently a raw, unmapped API response.** The real shape of F1's gameweek-history endpoint wasn't confirmed at build time, so rather than guess a schema, the fetch script stores the raw response as-is. The frontend doesn't render it yet — a follow-up would inspect the real response and add a proper mapper (see `shared/src/types.ts`).
