# CooL community: master specification alignment and integration map

Reviewed: 30 October 2026. Source of product requirements: Northwind Cipher Pixel-Art Community Virtual Office, Master Implementation Specification v1.0, 29 October 2026, sections 01–50. Later user decisions preserve a monochrome palette and make the community workspace immediately visible. The main company website is still in development; this feature will be integrated under `/community`.

## Confirmed product and inspected repository

The community is for **Northwind-Cipher/cool-sdk**: https://github.com/Northwind-Cipher/cool-sdk. It is not a website for managing local AI coding agents. The Munder Difflin Electron harness is retained at `/legacy` for reference; it is not the contributor backend.

Verified through read-only GitHub access: public repository, default branch `main`, TypeScript, package `cool-nwc`, repository license `BUSL-1.1`. Read the repository's README, CONTRIBUTING.md and package.json. The public README describes a developer SDK and CLI for independently verifiable execution evidence. This community does not run the SDK or execute contributor code. The SDK's evidence / signing / attestation pipeline is separate from the website's GitHub synchronization pipeline.

Canonical contribution guide: https://github.com/Northwind-Cipher/cool-sdk/blob/main/CONTRIBUTING.md. Security reports: https://github.com/Northwind-Cipher/cool-sdk/blob/main/SECURITY.md. The community links these sources rather than inventing project rules or licensing terms. No remote repository was modified, and no GitHub installation or repository-write permission was requested.

## Actual implementation checkpoint

| Area | Current behavior | Production connection still needed |
| --- | --- | --- |
| Community shell | React / TypeScript / Vite, workspace first, black-and-white, project and accessible page navigation | Main website router and global navigation adapter, once its source exists |
| Product discovery | CooL is the default real project; fixture projects stay isolated in demo provider | Authorized server project directory and repository enrollment |
| Repository work | Actual public REST reads of CooL issues and PRs; escaped text, canonical links, last fetched time, errors | GitHub App installation, signed webhooks, durable read models and reconciliation |
| Saved work | Real issue / PR references can be saved on this browser and reopened on GitHub | Authenticated user UUID + durable saved-work table |
| Characters | Three deterministic demo participants follow walkable paths; Play/Pause, Restart and stage selection | Authorized room snapshots with opt-in real presence |
| Contributor story | Example issue → PR → review → merge, always labeled simulated | Actual GitHub evidence, with corrections, revocation and bot handling |
| Profiles / events | Clearly marked sample data; optional local profile | Main website identity adapter, privacy-controlled profiles, durable events / RSVP |
| Chat / moderation | No remote messaging or privileged moderator access | Persisted delivery, idempotency, block/report permissions and audited moderation |
| Operations | No new paid service; local tests and web build | Provider choice, region / quota validation, cost monitoring, restore drill and launch gates |

The original document proposes Next.js as an assumption. The supplied workspace actually uses Vite; no framework migration was performed. A main-site framework choice must be based on its actual repository, not the document's assumption. Database, authentication and room-service providers are not provisioned by this checkpoint.

## Code connection points

| File | Responsibility | Future replacement / adapter |
| --- | --- | --- |
| `src/renderer/src/community/CommunityApp.tsx` | Route composition, local onboarding and actions | Host router, session / permission-aware API commands |
| `WorkspaceHome.tsx` | Office-first layout, project shortcuts, demo controls | Host identity / room selection; retain usable directory alternatives |
| `OfficeGame.tsx` | Phaser lifecycle, input, camera, collision, rendering | Authoritative room adapter; prediction / interpolation separate from rendering |
| `roomDemo.ts` | Pure deterministic sample members and collision-safe paths | A live room provider returning authorized member snapshots, never a fake connected fallback |
| `ContributorDemo.tsx` | Explicit simulation controls and semantic member / stage list | Keep as optional tutorial; never mix sample merges with real contribution credit |
| `coolRepository.ts` | Allowlisted public repository configuration, validated public API read, bounded cache / timeout | Server-owned project read API backed by normalized GitHub tables |
| `CoolProjectPage.tsx` | Contribution instructions, actual public issue / PR UI, GitHub links | Same view consuming authorized server read models with source / sync metadata |
| `SavedCoolWork.tsx` | Local canonical references to saved GitHub work | Persistent saved_issue / saved_pull_request records tied to an authenticated UUID |
| `data.ts` | Separate `communityProvider` and `demoProvider` | Server project provider; deterministic fixtures remain test-only / labeled demo |
| `localState.ts` | Bounded, validated browser-local preferences | Durable settings API; never a session or role source |

Do not copy this sandbox's root `main.tsx` into the company website. It makes `/` convenient for local review and preserves the old harness at `/legacy`. The real company homepage should stay intact, with the community feature mounted at `/community`. Adapt navigation to the host router and reuse the website's existing session provider. Scoped community CSS should remain inside the feature; review root/global styles during integration.

## Data flow now

```text
CooL public GitHub API
  → two read-only browser GETs (issues and PRs)
  → runtime validation and canonical link checks
  → short in-memory cache and project view
  → local saved references when the visitor chooses Save

Deterministic demo clock
  → sample room provider
  → collision-safe animated characters + semantic tutorial
```

The two flows stay separate. No simulated user, merge, score or presence is written to GitHub or presented as a verified contribution. Profiles and event examples remain labeled fixtures. Existing local saves from earlier sample projects are retained and marked as demo work.

## Intended production data flow

```text
Selected CooL GitHub App installation
  → HTTPS webhook endpoint, body limit, raw-byte HMAC-SHA256 validation
  → unique delivery record + authorized installation/repository validation
  → bounded processing queue / worker, idempotent writes and retry visibility
  → normalized issue / PR / release / contribution read models in PostgreSQL
  → authorized community API with visibility-aware queries
  → project pages, saved-work updates and evidence-based contribution views

Scheduled reconciliation
  → paginated GitHub reads with ETags and quota controls
  → repair missed / stale issue and PR state
```

Proposed endpoints below are an integration contract, not deployed endpoints:

| Boundary | Proposed route | Security / ownership |
| --- | --- | --- |
| Public project reads | `GET /api/community/projects`, `GET /api/community/projects/:slug/work` | Public fields only; bounded filters / cursor pagination |
| Profile and saves | `PATCH /api/community/me`, `PUT /api/community/me/saved-work/:id` | Server session identity, CSRF protection where applicable, resource checks |
| Room join | `POST /api/community/rooms/:id/join` | Authenticate, check visibility, membership, bans and capacity; issue scoped short-lived join authorization |
| GitHub enrollment | `POST /api/community/github/installations` | Separate from identity sign-in; verify installation and maintainer control |
| Webhook ingress | `POST /api/community/github/webhooks` | Verify raw bytes before processing; deduplicate deliveries and reject invalid signatures |
| Reports / actions | `POST /api/community/reports`, moderator-scoped action endpoints | Subject-specific authorization and audit history; no browser-assigned roles |

The main website's login establishes an internal user UUID. GitHub identity linking is a separate proof-of-control step; a repository App installation is a third, explicit authorization. A GitHub username is display data, not a durable primary key. No service-role secret or App private key belongs in Vite public variables.

## Intended live room flow

```text
Website session → server room-join authorization → authenticated WebSocket room coordinator
  → bounded move_intent / interact / send_chat events
  → server origin / access / rate / sequence / collision / range checks
  → authoritative snapshots and acknowledged actions
  → Phaser interpolation and accessible member / message lists
```

Transient coordinates belong in the coordinator, not a durable movement-event table. Persist profiles, project memberships, saved work, event RSVPs, intentional messages and moderation records. The current `RoomEnvelope` coordinate helper is a local prototype validator; it is not the production `move_intent` protocol and must not be treated as server authority. Client-side desk clicks currently navigate public pages; future protected room actions must pass through the same permission-checked server dispatcher as keyboard interactions.

## Phases and gates against the master specification

- Sections 01–09, 16–17, 25: public and local UI foundation exists. Original art, input, room identity, accessible alternatives and sample onboarding are implemented. Live profile privacy, spawn/map flood-fill coverage and comprehensive accessibility checks remain launch work.
- Sections 10–13, 18, 21–24, 30–33: architecture boundaries are documented. Real authentication, migrations, durable APIs, authoritative sockets, remote chat and moderation enforcement are not deployed.
- Sections 14–15, 32, 44: public read-only CooL data is implemented. Installation verification, webhook signatures / deduplication, reconciliation and durable attribution are not implemented or claimed tested.
- Sections 19–20: event and cosmetic examples remain optional prototype behavior. No paid shop, productivity ranking, voice, video or code execution was added.
- Sections 26–28, 34–39, 46–50: launch / operational gates remain open. No 100-client capacity claim, recovery guarantee, legal age policy, production monitoring or budget sufficiency claim is made.

## Verification, quota and cost notes

Community tests cover existing discovery / local-state / collision behavior plus public API parsing, repository URL confinement, omitted credentials, pull-request exclusion from issue lists, rate-limit and payload failures, path reachability, deterministic simulated motion and story-stage wrapping. These are unit and browser prototype checks, not production authentication / webhook / database / multiplayer integration tests.

Browser verification on 30 October 2026: CooL project page fetched actual public data, displaying 0 open issues and 10 open pull requests at that time; PR #15 could be saved locally and reopened from Saved Work. Those counts are observations, not permanent metadata or a completeness claim. The UI reads only the first API page, up to 30 results per list, and links to canonical GitHub pages for full context. Play/Pause and stage controls updated the simulated member activities.

No dependency, provider plan, paid service, secret, GitHub mutation or production setting was added. No environment variables are required for this public-read / demo checkpoint. The only extra allowed network host is `https://api.github.com` in the renderer CSP. Account for normal network request information sent to GitHub; the privacy draft describes this read.

GitHub's official rate-limit documentation, checked 30 October 2026, specifies an unauthenticated limit of 60 requests/hour tied to the originating IP: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api. Current reads are coalesced and cached in memory for five minutes. Reloading the app or many people behind a shared IP can still exhaust quota. Rate-limit failures surface an error and keep canonical repository links available; no fake data replaces a failed response. Production should use an authorized App with centralized caching, webhook updates and quota controls. Current provider usage is not an assurance that the ₹2,000/month production budget supports every planned service.

## Next integration step

When the company website source is ready: audit its actual routes, session mechanism, server runtime and data layer; mount this feature at `/community`; then implement one server-backed slice from identity → saved issue → durable persistence → authorized read. After provider and configuration decisions, add the CooL GitHub App synchronization pipeline, followed by authoritative rooms. Review schema, secrets, provider quotas and operating costs before provisioning or changing production data ownership.

Final checkpoint: `npm run typecheck:web` passed; 16 focused community tests passed; `npm run build:web` passed (4m 13s). The remaining warnings concern existing large legacy / engine bundles. No realtime load test, OAuth, database, webhook or permission integration test is claimed. Added `npm run test:community` as the repeatable focused test command.
