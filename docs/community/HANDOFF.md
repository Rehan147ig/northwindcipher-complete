# Handoff: continue the Northwind Cipher community platform

Written for a coding agent (Qwen in Qoder) picking up mid-project. Read this fully before editing. Work from `D:\NorthwindCipher-Community\munder-difflin`.

## 1. What this is
A contributor + community site for the open-source product **CooL** at `/community/*`, inside the existing Vite + React app (not Next.js). Visitors browse projects; contributors sign up, **verify** (confirmed email + linked GitHub), manage projects, and see a pixel-art virtual office. Backend = Supabase (auth + Postgres + RLS) and Vercel serverless functions in `api/`.

Stack facts (do not change without the owner's approval): Vite 5, React 18, TypeScript, Pixi.js v8 for the office (not Phaser), `@supabase/supabase-js` v2, plain `node --test` tests. The spec in the owner's master document (50 sections) is the source of truth for scope; voice/video/code execution/paid features are out of scope.

## 2. Rules and gotchas (learned the hard way)
- **Never print, log, commit or ask for secrets.** `.env` is gitignored; the owner edits it themselves. Check variables by name only: `grep -o '^[A-Za-z_]*=' .env`. The two Supabase keys were once pasted in chat: remind the owner to rotate them.
- **Bash tool collapses `\\` to `\`**, breaking regexes and JSON written through heredocs/`python - <<`. Create or edit any file containing backslashes with the file Write/Edit tools, then verify (`node -e "JSON.parse(...)"`, tests).
- **`npm run x -- --force` is eaten by npm.** Never rely on a bare `--force` flag; use prompts or positional args.
- Dev server: `npx vite --port 5199 --strictPort` (also serves `/api/*` via the `apiDevServer` plugin in `vite.config.ts`; `.env` is read from the repo root through `envDir`). Restart after any `.env` change.
- Never create accounts or sign in on the owner's hosted Supabase yourself; ask the owner to do it and report what they see.
- Docker was not running on the owner's machine, so `npm run test:rls` has never executed locally. CI runs it against a Postgres service.
- `global.css` sets `overflow:hidden` on html/body/#root for the desktop app; community pages override it with the `nw-community-body` class (added in `CommunityApp.tsx`). Keep that.
- Match the surrounding code: the community files are dense one-liners (`community/*.tsx`); newer files (`AuthPage`, `Dashboard`, `AdminPanel`) are more readable. Do not reformat existing files wholesale.

## 3. Map
| Area | Files |
|---|---|
| Routing + pages | `src/renderer/src/community/CommunityApp.tsx` (path switch on `section`) |
| Auth UI | `AuthPage.tsx`, `authErrors.ts`, `redirect.ts` (`safeReturnPath`), `supabase.ts` (`fetchAuthSettings` hides GitHub buttons when the provider is off) |
| Dashboard / admin | `Dashboard.tsx` (verification, export/delete), `AdminPanel.tsx` (projects, repo enrollment, reports, audit, deliveries), `repoInput.ts` |
| Office | `OriginalCommunityOffice.tsx` (Pixi; 3 room layouts in `layouts`), `world.ts`, `roomDemo.ts`, `scene/office/*` |
| Serverless | `api/github-webhook.ts` + `api/_lib/githubWebhook.ts`, `api/account.ts` + `_lib/account.ts`, `api/admin.ts` + `_lib/admin.ts` (pure handlers injected with a store; tests are `api/*.test.cjs`) |
| Database | `supabase/migrations/0001..0006`, `supabase/setup-all.sql` (concatenation; regenerate with `cat supabase/migrations/000*.sql > supabase/setup-all.sql`), tests `supabase/tests/{setup,rls}.sql` |
| Email | `supabase/templates/build.mjs` (generator), outputs `*.html`, `subjects.txt`; `scripts/apply-email-templates.mjs` (supports optional SMTP via env vars) |
| Ops | `vercel.json`, `.github/workflows/ci.yml` (job `community`), `docs/community/SETUP.md` (runbook) |

## 4. Verify before and after every change
```
npx tsc --noEmit -p tsconfig.web.json
npm run typecheck:api
npm run test:community        # expect 43+ pass, 0 fail
npm run build:web             # about 90 s
npm run test:rls              # needs Docker or RLS_DATABASE_URL
```
Add tests next to every new feature (see `api/*.test.cjs`, `src/renderer/src/community/*.test.cjs`; TS is loaded via `test/load-ts.cjs`).

## 5. State
Done: signup/login, dashboard, verification function (`refresh_my_verification`), account export/delete API, admin panel, repo-claim protection (0006), webhook endpoint with replay protection, branded email templates, three room layouts, Vercel config.

Owner-side steps still pending (do not attempt; remind the owner): run migrations `0005`, `0006`; insert themselves into `app_roles` as `owner`; enable GitHub provider + manual linking in Supabase; `npm run email:apply -- apply` (needs their Supabase access token; optional SMTP via `SMTP_HOST/PORT/USER/PASS/FROM` env vars in their own shell); set `GITHUB_WEBHOOK_SECRET`; deploy to Vercel with env vars; legal/age-policy review.

## 6. Next tasks, in priority order (each with acceptance criteria)

**T1. Database-backed project and issue directory (medium).**
Replace the demo fixtures in `community/data.ts` for projects/issues with Supabase reads (`projects`, `repositories`, `github_issues`; RLS already limits visibility). Keep the fixtures as a fallback when Supabase is not configured or tables are empty (the page must never be blank). Add a `provider` abstraction already hinted at by `demoProvider`. Accept: public project list and detail pages render real rows for anonymous visitors; private projects never appear; empty state links to "Create a project" for signed-in users; unit tests for the mapping/filter functions.

**T2. Reports flow (small-medium).**
Add a "Report" button on project, profile and contributor pages that inserts into `reports` (policy: `reporter_id = auth.uid()`, status `open`). Needs a modal with category + optional description (max 2000 chars), success/error states, rate limiting UX (disable for 30 s). Accept: signed-in user can file a report and sees it appear in Admin → Reports for a moderator; anonymous users are prompted to log in.

**T3. Persist saved issues and event interest per account (small).**
`localState.ts` stores saves in the browser. When signed in, sync `saved_issues` (column exists on `profiles`, update column privilege is granted) both ways; local storage stays as the signed-out store. Accept: saving on one browser appears on another after login; never exceed 100 entries.

**T4. Rate limiting and abuse controls (small-medium).**
Add an in-DB or edge limiter for `/api/*` (per IP and per user). Without shared state serverless instances can't count in memory: use a small `rate_limits` table with an atomic upsert function, or Vercel's firewall rules. Document the choice. Accept: tests for the limiter logic; 429 with `Retry-After`.

**T5. Reconciliation for missed webhook events (medium).**
`api/reconcile.ts` (Vercel cron, secret-protected via `CRON_SECRET`): for enrolled repositories fetch open issues/PRs from the GitHub REST API with ETags and upsert via the same normalizers in `api/_lib/githubWebhook.ts`. Respect rate limits; mark `repositories.sync_status` (`rate_limited`, `error`, `active`). Accept: unit tests with a fake fetcher; idempotent runs.

**T6. Events and RSVPs in the database (medium).**
New migration `0007` with `events` and `event_rsvps` (UTC times, unique `(event_id,user_id)`, RLS: public events readable, own RSVP writable), then replace the fixture events. Accept: RLS tests added to `supabase/tests/rls.sql`; UI shows local time zone and handles cancelled events.

**T7. Accessibility and mobile pass (small-medium).**
Keyboard path for the whole signup→dashboard→admin flow, visible focus, labelled controls, `prefers-reduced-motion` support in the office (`OriginalCommunityOffice.tsx` camera lerp and animations), a list-mode fallback for the office on small screens. Accept: manual checklist in `docs/community/A11Y.md` plus screenshots at 375 px and 1280 px.

**T8. Real multiplayer office (large; needs a design decision first).**
Do not start coding before the owner approves the provider. Write `docs/community/REALTIME_DESIGN.md` comparing Cloudflare Durable Objects vs a small WebSocket service on current free-tier limits (re-verify quotas, ₹2,000/month cap), then implement the protocol from spec sections 10, 11 and 43: typed event envelopes with Zod, server-authoritative movement using the same collision data as `world.ts`, capacity caps, reconnect snapshots, opt-in presence. Load test 100 synthetic clients before launch.

## 7. Definition of done for any task
Types strict, no secrets in code or logs, authorization enforced server-side or by RLS (never only in the UI), error/empty/loading states present, tests added and passing, `setup-all.sql` regenerated if migrations changed, and `docs/community/SETUP.md` updated if setup changes.

## 8. Vercel deployment (working as of 30 Oct 2026)
Project: `northwind-cipher-community` (account `mdrehansk143-9280`, team `shaik-mohammad-rehans-projects`). Preview deployments are protected by Vercel Authentication; test them with `MSYS_NO_PATHCONV=1 npx vercel curl /community --deployment <url>` (Git Bash rewrites `/paths` without that variable).

How to deploy:
1. Copy only the needed files to a folder **outside git** (deploying from the repo is marked "Blocked" because the last commit's author is not on the Vercel team): `api` (no tests), `src` (no `src/main`), `package.json`, `package-lock.json`, `vite.config.ts`, `vercel.json`, `tsconfig.json`, `tsconfig.web.json`, `tsconfig.node.json`, `docs/logo.png`, `docs/community/nc-logo.svg`, `.vercel/project.json`. Never copy `.env*`.
2. In that folder: `npx vercel deploy --yes` (preview) or `npx vercel deploy --prod --yes`.

Lessons already fixed (do not undo): `api/package.json` sets `"type": "module"` and handler imports use `./_lib/x.js`; `vercel.json` sets `NPM_CONFIG_IGNORE_SCRIPTS=true` (the Electron `postinstall` cannot run on Vercel) and must NOT use `cleanUrls` (it breaks the SPA rewrite to `/index.html`). Never run `vercel build` locally: it runs `npm ci`, which wipes `node_modules` and fails on files locked by a running dev server.

Required Vercel environment variables (owner sets them; `VITE_*` are baked in at build time, so redeploy after changing them): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_WEBHOOK_SECRET`. Without the server ones `/api/*` returns `503 not_configured` (expected).

Local note: the last `npm ci` restored all packages, but the desktop app's `electron-rebuild` postinstall failed on this machine (needs C++ build tools). The web community app and tests are unaffected; the Electron desktop app may need `npx electron-rebuild` after installing Visual Studio Build Tools.
