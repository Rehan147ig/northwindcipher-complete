// Checks the live Supabase database and applies only the missing migrations, each in its own transaction.
// Uses the Supabase Management API with YOUR personal access token (dashboard -> Account -> Access Tokens),
// typed at a hidden prompt or provided as SUPABASE_ACCESS_TOKEN in your own shell. Nothing secret is printed.
//
//   npm run db:apply                 -> report only (what exists, what would be applied)
//   npm run db:apply -- apply        -> apply missing migrations, backfill profiles, reload the API schema
//   npm run db:apply -- apply site=https://your-domain   -> also set Auth Site URL + redirect allow-list
import readline from 'node:readline';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('apply');
const site = (process.argv.find((a) => a.startsWith('site=')) || '').slice(5).replace(/\/+$/, '');

const envLine = (name) => {
  try { const l = readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).find((x) => x.startsWith(`${name}=`)); return l ? l.slice(name.length + 1).trim() : ''; } catch { return ''; }
};
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(envLine('VITE_SUPABASE_URL'))?.[1];
if (!ref) { console.error('Could not read VITE_SUPABASE_URL from .env'); process.exit(1); }
if (site && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(site)) { console.error('site= must be an https origin, e.g. site=https://example.vercel.app'); process.exit(1); }

function askHidden(q) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(q); let muted = true;
    rl._writeToOutput = (s) => { if (!muted || s === '\r\n' || s === '\n') process.stdout.write(s); else process.stdout.write('*'); };
    rl.question('', (a) => { muted = false; rl.close(); resolve(a.trim()); });
  });
}
const token = process.env.SUPABASE_ACCESS_TOKEN || (await askHidden('Supabase personal access token (sbp_...): '));
if (!token) { console.error('No token provided.'); process.exit(1); }

const api = `https://api.supabase.com/v1/projects/${ref}`;
async function sql(query) {
  const res = await fetch(`${api}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
}

// What exists right now.
const state = (await sql(`
  select
    exists(select 1 from information_schema.tables where table_schema='public' and table_name='profiles') as m0001,
    exists(select 1 from information_schema.tables where table_schema='public' and table_name='projects') as m0002,
    exists(select 1 from information_schema.tables where table_schema='public' and table_name='repositories') as m0003,
    exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='verified_at') as m0004,
    coalesce((select is_nullable='YES' from information_schema.columns where table_schema='public' and table_name='reports' and column_name='reporter_id'), false) as m0005,
    coalesce((select qual is null and with_check like '%verified_at%' from pg_policies where schemaname='public' and tablename='repositories' and policyname='repositories enroll'), false) as m0006,
    (select count(*) from auth.users)::int as users`))[0];

const files = readdirSync(join(root, 'supabase/migrations')).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const done = (f) => Boolean(state[`m${f.slice(0, 4)}`]);
const pending = files.filter((f) => !done(f));
console.log(`Project ${ref}: ${state.users} auth user(s).`);
for (const f of files) console.log(`  ${done(f) ? 'present ' : 'MISSING '} ${f}`);
if (site) console.log(`Auth Site URL would be set to ${site} (+ ${site}/community/**, http://localhost:5199/**)`);
if (!apply) { console.log('\nReport only. Re-run with:  npm run db:apply -- apply'); process.exit(0); }

for (const f of pending) {
  process.stdout.write(`Applying ${f} ... `);
  // One transaction per migration: a failure leaves that migration completely unapplied.
  await sql(`begin;\n${readFileSync(join(root, 'supabase/migrations', f), 'utf8')}\ncommit;`);
  console.log('ok');
}
await sql(`notify pgrst, 'reload schema';`);
const check = (await sql(`select (select count(*) from public.profiles)::int as profiles, (select count(*) from auth.users)::int as users,
  (select count(*) from pg_tables where schemaname='public' and rowsecurity=false and tablename in ('profiles','projects','project_memberships','reports','audit_events','app_roles','repositories','github_issues','pull_requests','webhook_deliveries'))::int as tables_without_rls`))[0];
console.log(`Profiles: ${check.profiles}/${check.users} users. Tables without RLS: ${check.tables_without_rls} (must be 0).`);

if (site) {
  const res = await fetch(`${api}/config/auth`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ site_url: site, uri_allow_list: `${site}/community/**,http://localhost:5199/**` }) });
  console.log(res.ok ? `Auth Site URL set to ${site}.` : `Could not update Auth URLs (HTTP ${res.status}); set them in the dashboard.`);
}
console.log('Done.');
