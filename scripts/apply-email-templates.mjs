// Pushes the branded email templates in supabase/templates to your Supabase project (Management API).
// Needs a personal access token (Supabase dashboard -> Account -> Access Tokens), typed at a hidden prompt or
// provided as SUPABASE_ACCESS_TOKEN in your own shell. The token is never printed or stored.
//
//   npm run email:apply            -> dry run: shows what would change
//   npm run email:apply -- apply   -> actually updates the project
//
// NOTE: the Management API field names below follow Supabase's documented auth config; if the API rejects a
// field, paste the templates in the dashboard instead (see supabase/templates/README.md).
import readline from 'node:readline';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const apply = process.argv.includes('apply');

function envValue(name) {
  try {
    const line = readFileSync(join(root, '.env'), 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : '';
  } catch { return ''; }
}

const url = envValue('VITE_SUPABASE_URL');
const ref = /^https:\/\/([a-z0-9]+)\.supabase\.co$/.exec(url)?.[1];
if (!ref) { console.error('Could not read VITE_SUPABASE_URL from .env.'); process.exit(1); }

const subjects = Object.fromEntries(readFileSync(join(root, 'supabase/templates/subjects.txt'), 'utf8').trim().split(/\r?\n/)
  .map((l) => [l.slice(0, 16).trim(), l.slice(17).trim()]));
const names = ['confirmation', 'recovery', 'magic_link', 'invite', 'email_change', 'reauthentication'];
const body = {};
for (const n of names) {
  body[`mailer_subjects_${n}`] = subjects[n];
  body[`mailer_templates_${n}_content`] = readFileSync(join(root, `supabase/templates/${n}.html`), 'utf8');
}

// Optional custom SMTP (recommended for production). Set these in YOUR shell before running, e.g. in PowerShell:
//   $env:SMTP_HOST='smtp.resend.com'; $env:SMTP_PORT='465'; $env:SMTP_USER='resend'; $env:SMTP_PASS='...'
//   $env:SMTP_FROM='community@your-domain.com'
// The password is read from the environment only; it is never printed.
if (process.env.SMTP_HOST) {
  const missing = ['SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'].filter((k) => !process.env[k]);
  if (missing.length) { console.error(`SMTP_HOST is set but these are missing: ${missing.join(', ')}`); process.exit(1); }
  Object.assign(body, {
    smtp_host: process.env.SMTP_HOST, smtp_port: String(process.env.SMTP_PORT), smtp_user: process.env.SMTP_USER,
    smtp_pass: process.env.SMTP_PASS, smtp_admin_email: process.env.SMTP_FROM, smtp_sender_name: 'Northwind Cipher',
  });
  console.log(`SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT} as ${process.env.SMTP_FROM} (password hidden)`);
}

console.log(`Project: ${ref}`);
for (const n of names) console.log(`  ${n.padEnd(16)} "${subjects[n]}" (${body[`mailer_templates_${n}_content`].length} bytes)`);
if (!apply) { console.log('\nDry run only. Re-run with:  npm run email:apply -- apply'); process.exit(0); }

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    process.stdout.write(question);
    let muted = true;
    rl._writeToOutput = (s) => { if (!muted || s === '\r\n' || s === '\n') process.stdout.write(s); else process.stdout.write('*'); };
    rl.question('', (answer) => { muted = false; rl.close(); resolve(answer.trim()); });
  });
}

const token = process.env.SUPABASE_ACCESS_TOKEN || (await askHidden('Supabase access token (sbp_...): '));
if (!token) { console.error('No token provided.'); process.exit(1); }

const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
if (!res.ok) {
  console.error(`\nSupabase rejected the update (HTTP ${res.status}).`);
  console.error((await res.text()).slice(0, 400));
  process.exit(1);
}
console.log('\nEmail templates updated. Send yourself a test sign-up email to check the result.');
