# Community platform: setup runbook

End-to-end order. Secrets live only in `.env` (local) and the Vercel dashboard; never in chat, commits or the browser bundle.

## 1. Supabase
1. SQL Editor: run `supabase/setup-all.sql` on a fresh project. On an existing project run only the migrations you have not applied yet (`0005`, `0006`, ...).
2. Authentication → Providers → Email: enabled. For production keep **Confirm email** on and configure custom SMTP (Authentication → SMTP Settings) with SPF/DKIM/DMARC.
3. Authentication → URL Configuration: Site URL = your production domain; add `https://your-domain/community/**` and `http://localhost:5199/**` to redirect URLs.
4. Authentication → Providers → **GitHub**: create a GitHub OAuth app (callback `https://<project-ref>.supabase.co/auth/v1/callback`), paste the client id/secret. Enable **manual linking** so existing members can link GitHub. The site hides the GitHub buttons until this is enabled.

## 2. Local environment
`.env` in the repo root (gitignored):
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server only
GITHUB_WEBHOOK_SECRET=...          # server only, random 32+ bytes
```
`npx vite --port 5199` serves the site and the `/api` functions.

## 3. First admin
Sign up on the site, then in the SQL Editor (replace the email):
```sql
insert into public.app_roles (user_id, role)
select id, 'owner' from auth.users where email = 'you@example.com';
```
Reload `/community/admin`: you now see Reports, Audit log and GitHub deliveries. Grant moderators the same way with role `moderator`.

## 4. Branded emails
`node supabase/templates/build.mjs` regenerates the templates. Apply them with `npm run email:apply` (dry run) then `npm run email:apply -- apply` (needs a Supabase access token), or paste them into Authentication → Email Templates.

## 5. Deploy (Vercel)
Import the repo. `vercel.json` already sets the install/build commands, SPA rewrites and cache headers. Add the four variables above in Project Settings → Environment Variables (Production and Preview), then redeploy.

## 6. GitHub webhook and repositories
1. Admin → My projects: create a project, then **Enroll repository**. You must be a *verified contributor* (confirmed email + linked GitHub) who owns that GitHub account/org, or a moderator.
2. In the repository: Settings → Webhooks → Add webhook. Payload URL `https://your-domain/api/github-webhook`, content type `application/json`, the same secret as `GITHUB_WEBHOOK_SECRET`, events: **Issues** and **Pull requests** only.
3. Admin → GitHub deliveries should show the ping as `ignored` and later events as `processed`.

## 7. Before launch
Rotate any key that was ever shared in chat, run `npm run test:rls` (needs Docker or `RLS_DATABASE_URL`), and review the age policy and privacy terms.
