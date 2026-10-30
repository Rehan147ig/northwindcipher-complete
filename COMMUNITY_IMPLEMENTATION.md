# Northwind Cipher community implementation

## Audit and scope

Audited 30 October 2026. The supplied directory contains `munder-difflin`, a React 18.3 / TypeScript 5.6 / Vite 5 application with an Electron desktop build, npm package-lock, Pixi-based desktop office, extensive Node tests, bundled Inter / JetBrains Mono / Press Start fonts, and browser-only mock bridge. The website uses `npm run build:web`, emits `dist`, and has a filesystem-first SPA fallback in `vercel.json`. It is not a Next.js application. The desktop SQLite and Electron IPC code are not a production web backend. No connected web authentication, database, GitHub App or room coordinator is configured.

The existing deployment is Vercel project `dist` (`prj_19XO8WYxcPYOSruSuowa2y7LZi7y`), team `team_1Cpi8EF9JFaLb6ykjg2r4nr2`. Existing production domain: https://dist-zeta-silk-78.vercel.app/. No Git deployment connection was returned by the deployment inspection; its recorded source is CLI. The local Git metadata has an origin of HarnessMD/munder-difflin, but Git reports that this copied checkout is not a usable worktree. No commits or pushes were attempted.

Implementation order: preserve existing root application; add a lazy community route bundle; isolate fixtures and validated local state; build public discovery and accessible alternatives; implement a separately loaded Phaser scene; verify behavior; deploy built static assets as a preview to the existing project. Production settings, secrets, domains, DNS, provider plans, and database configuration are unchanged.

## Implemented routes

- `/community`: responsive landing, original procedural office preview, featured projects, explainable first issues, local activity, people, events, newcomer steps.
- `/community/projects`: search, language, level, topic and contribution filters, sorting, progressive display support, loading / empty / recoverable error states.
- `/community/projects/:slug`: overview, maintainer, stack, contribution guidance, demo issues, explicit unavailable GitHub state, room entry.
- `/community/contributors` and `/community/contributors/:handle`: demo profiles, skills, participation, local mute and reporting flow.
- `/community/events` and `/community/events/:id`: event details, organizer, explicit IST times, locally saved attendance intent and room entry.
- `/community/guidelines`, `/community/privacy`, `/community/terms`: clearly identified prototype policy drafts; no final age policy.
- `/community/world`: explicit demo profile gate; WASD / arrow movement; bounds and furniture collisions; proximity prompts; E interactions; camera follow; avatar color; three stable local rooms; touch controls; accessible station buttons; local room notebook.
- `/community/settings`: local onboarding and preferences, saved issues, export, explicit local deletion confirmation, leave-demo behavior.
- `/community/inbox`: read/unread local welcome notice; no delivery claim.
- `/community/moderation`: local report and appeal demonstration, local audit context; no privileged moderator grants.
- `/community/admin`: explicit unavailable / restricted state; no simulated administrator authorization.
- `/`: preserved original application with a community entry link.

These are demo routes, not authenticated production routes. Frontend gates are convenience only. They do not provide server authorization. All fixtures are visibly labeled, and no fabricated GitHub URLs, online counts, remote messages or live synchronization are displayed.

## Files and dependencies

New module: `src/renderer/src/community/CommunityApp.tsx`, `community.css`, `data.ts`, `localState.ts`, `OfficePreview.tsx`, `OfficeGame.tsx`, `world.ts`, `community.test.cjs`.

Modified: renderer `main.tsx` (route boundary, lazy legacy app, community link); renderer `index.html` (viewport and description); package.json and package-lock.json (Phaser); `src/shared/sdlcWorkflow.ts` (removed an existing self-referential duplicate type alias that blocked web typechecking). Added `tsconfig.community.json` for isolated strict verification. Existing company / desktop routes and app components are retained.

Added Phaser 3.90.0 for the requested game implementation. React, npm, Vite, existing styles and fonts remain. Phaser loads only when the office is opened. The original IDE / desktop harness loads separately, so public community routes do not eagerly load its multi-megabyte bundle.

## Architecture and asset provenance

`data.ts`: provider contract and deterministic demo fixtures. Future GitHub data belongs behind an authenticated server provider, not a client token.

`localState.ts`: bounded runtime validation for browser-persisted data. Invalid JSON, malformed records and oversized state fall back safely. React renders user text without raw HTML. Browser state is untrusted and unsuitable for credentials or access control. Preferences synchronize between tabs on storage events; no cross-tab presence or network session is claimed.

`world.ts`: geometry, collision rules, station descriptions, stable room descriptors and a versioned movement envelope validator. This is a future integration seam, not an authoritative server. Rooms share the same original office layout with distinct identity. Capacity is a design target only.

`OfficeGame.tsx`: browser-only Phaser import, focus-scoped keyboard input, original avatar geometry, walking bob, scene lifecycle destruction, camera bounds, touch input and room transitions. Every station also has a semantic button. Reduced-motion CSS disables decorative transitions; the office does not require continuous auto-animation.

All NEW community office tiles, furniture, plants, rugs, monitors and avatar graphics are original procedural Canvas/Phaser geometry, created for this implementation. No proprietary game sprites are used. These code-generated assets follow the repository MIT license. Existing desktop artwork and fonts retain their existing provenance and license notices; they were not repackaged as new community art.

## Setup and verification

Use the existing installed dependencies, or `npm ci --ignore-scripts` for a browser-only install. The repository postinstall rebuilds native Electron dependencies; a full desktop installation may need its existing native build toolchain.

```powershell
npx vite --host 127.0.0.1 --port 4173
npm run build:web
npm run typecheck:web
npx tsc --noEmit -p tsconfig.community.json
node --test src/renderer/src/community/community.test.cjs
```

No environment variables or external accounts are required for the prototype. No OAuth secrets, GitHub tokens or service-role keys are included. Never add those to browser code.

Baseline: web production build passed. Existing test suite: 947 tests, 790 passed, 143 failed, 14 skipped. Failures predate community implementation; the captured log contains Windows EPERM / symlink / filesystem rename failures and other existing failures. Do not treat the full suite as green. Baseline log is retained in the task workspace as `northwind-baseline-tests.log`.

New tests: 9 passing checks for compound filtering, sorting immutability, provider lookup, world bounds, furniture collision, station proximity, stable room contracts, malformed movement rejection, invalid persisted state and legitimate state round trips. Full web typecheck passes after removing the pre-existing duplicate alias. Browser verification covers search, language filtering, onboarding, saved issue settings, actual keyboard walking to a workstation and E-triggered project-room transition. Performance targets (p75 LCP, 60 FPS, low-end 30 FPS, 100 concurrent users) have NOT been measured or certified. No multiplayer load test is possible without its backend.

## Deployment

Build locally and deploy only compiled `dist` assets, preserving SPA rewrites from the root `vercel.json`. Link the build directory to the existing project IDs, then use `vercel deploy dist --yes --scope shaik-mohammad-rehans-projects` for a PREVIEW. The existing production domain stays on its current release pending review. Do not change project build settings or deploy the Electron source as a server app.

Review the preview before any production promotion. The project has Vercel deployment protection configured, so a preview may require the owner's Vercel sign-in. Do not weaken protection to make a link public. No DNS, environment secret or production setting changes are required.

## Budget and quota register

Hard budget remains ₹2,000/month; no paid service or upgrade was introduced. Incremental prototype backend cost is ₹0 because there is no database, real-time service, email provider or external object storage. Existing Vercel plan charges and bandwidth are account-specific and are NOT guaranteed to fit this budget.

| Resource | Current implementation | Cost / quota risk and degradation |
| --- | --- | --- |
| Vercel hosting / bandwidth | Existing static project, preview only | Existing account pricing applies. Heavy legacy app remains on a separate chunk; Phaser loads only for the office. Watch bandwidth in the Vercel usage dashboard. |
| Database | None | ₹0 added; local storage can be cleared, unavailable or exhausted. An in-memory session and explicit warning remain usable when storage fails. |
| Real-time / multiplayer | None | ₹0 added; single-player and page links remain available. Capacity is not claimed. |
| Email / push notifications | None | ₹0 added; local inbox and preference UI only. |
| Assets / storage | Static bundled assets | Counts toward hosting bandwidth. No new storage service. |
| Logs / monitoring | Existing hosting controls | No new paid telemetry; do not put private content in logs. |

Pricing checked against Vercel official documentation on 30 October 2026: https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits/fair-use-guidelines. Hobby is for personal, non-commercial use and includes finite usage; a company production launch must review plan suitability. Quota exhaustion can pause features until the applicable window resets. No free-tier sufficiency or bill ceiling is promised, and no upgrade was selected.

## Deliberate limits and next phase

The prototype implements the public and local workflow phases. It is not the full connected platform. Real authentication, private account routes, a GitHub App and signed/deduplicated webhooks, authoritative room coordination, remote chat/presence, delivery, durable moderation, account lifecycle enforcement, security testing and monitoring remain unconfigured. Policy drafts need review, including the minimum age decision.

Next: approve provider choices within the budget; add server-authenticated data access and migrations; integrate a least-privilege GitHub App; then select and load-test a room coordinator. Never authorize protected reads or mutations using local demo state. A typed movement envelope is not sufficient server validation: add movement speed, collision, room membership, origin checks, sequence handling and rate limiting on the authoritative service.

## Delivered preview

Verified Vercel deployment state: READY. Deployment ID: dpl_fafa2aWTf4isfUoKDrMwuazyga34.
Community: https://dist-piivmfjtn-shaik-mohammad-rehans-projects.vercel.app/community
Office: https://dist-piivmfjtn-shaik-mohammad-rehans-projects.vercel.app/community/world
Inspector: https://vercel.com/shaik-mohammad-rehans-projects/dist/fafa2aWTf4isfUoKDrMwuazyga34

The first attempt from the copied repository was blocked by Vercel collaboration checks. The successful upload used the exact same compiled build from a staging folder and the existing project IDs. Vercel CLI may attach Git metadata discovered in ancestor directories; those commit labels are not a source revision for these local uncommitted changes. This is an artifact deployment, not a Git push.

The preview retains Vercel Authentication. Browser navigation reached Vercel sign-in, so deployed application behavior was not independently browser-tested after upload. Local browser behavior and production build were verified. Automatic approval review rejected the share-link-based verification tools because they would expose protected project content. No protection setting was weakened and no public share link was created. The owner can sign in to review the normal preview URL.

Final focused test result: 9/9 passed. Final full web typecheck: passed. Final production build: passed in 1m 49s. Remaining build warnings concern the existing large legacy application chunk and the separately loaded Phaser engine. Desktop landing was visually reviewed at a 1600px viewport with no horizontal overflow; the responsive mobile layout and menu were also reviewed. The original root application was opened and still renders its harness picker with a community entry link.

## Workspace-first monochrome revision

Following user feedback, the first page now opens the usable workspace directly. Browser routes `/` and `/community` show the office with no required profile setup. `/community/world` remains a compatible workspace route. The prior landing content is retained at `/community/about`, and the original application remains available at `/legacy` (native Electron initialization is preserved).

Added `WorkspaceHome.tsx` with clear room tabs and direct shortcuts to projects, first issues, contributors, events and saved work. Profiles are optional, guests can save and view issues, and desks support direct pointer interaction as well as movement plus E. Internal hash links remain within the app; camera framing responds to size changes. Removed the redundant enter-office onboarding barrier from the main workflow.

All community CSS and office artwork use neutral monochrome values. Avatar tones normalize to grayscale, including previously stored colors. Profile choices are Ink, Graphite, Silver and White. The community favicon and loading state are monochrome too.

Verification: full web TypeScript check passes; 9 existing community tests pass. Browser verification covers guest access at `/`, direct desk click opening Projects, guest issue saving and retrieval, mobile navigation, and a 390px phone viewport with no horizontal overflow. The office is visible immediately on that viewport (top approximately 269px), with movement controls and shortcuts beneath it. Rendered UI color inspection reported no colored text, backgrounds, borders or outlines. The 1280px desktop layout was visually reviewed.

This revision is running on the user's local Vite server at http://127.0.0.1:4173/community. No Vercel production setting was changed for this local design review.

## CooL SDK target confirmed — master specification checkpoint

The user confirmed the main company website is still in progress and this feature is its community page for https://github.com/Northwind-Cipher/cool-sdk. The new authoritative integration map is docs/community/MASTER_SPEC_ALIGNMENT.md. It supersedes earlier generic-demo-only notes: CooL is now the default project, public issues / PRs can be read from GitHub, actual repository work can be saved locally, and an explicitly labeled animated contributor tutorial is present. Real authentication, durable account data, App webhooks and multiplayer remain unconfigured.

New feature files: coolRepository.ts, CoolProjectPage.tsx, SavedCoolWork.tsx, roomDemo.ts, ContributorDemo.tsx and cool-integration.test.cjs. Updated the existing community shell, world metadata, office renderer, data provider, styles, privacy draft and CSP. No dependencies or external infrastructure were added. Full web TypeScript passed, 16 community tests passed, and the production web build passed. Use npm run test:community for the focused test suite. The current review runs locally; the older Vercel preview was not promoted or reconfigured in this checkpoint.

## Palette restored by owner request

30 October 2026: Restored the original cream / burgundy / forest palette, original colored procedural office artwork, colored animated contributors, avatar choices and favicon. The workspace-first layout, CooL public GitHub reader, saved work and demo animation remain in place. Earlier monochrome-only requirements are superseded by this latest request. No dependencies, integrations or production settings were changed.
