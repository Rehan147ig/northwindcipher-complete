// Interactive, local-only .env writer. Keys are typed (hidden) into YOUR terminal and never printed or logged.
// Usage: npm run setup:env [-- --force]
import readline from 'node:readline';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // Print the question normally, then mask only what is typed afterwards.
    process.stdout.write(question);
    let muted = hidden;
    rl._writeToOutput = (s) => { if (!muted || s === '\r\n' || s === '\n') process.stdout.write(s); else process.stdout.write('*'); };
    rl.question('', (answer) => { muted = false; rl.close(); resolve(answer.trim()); });
  });
}

function jwtClaims(token) {
  try { return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { return null; }
}

// npm swallows a bare `--force`, so ask instead of relying on a flag.
if (existsSync(target)) {
  const answer = await ask('.env already exists. Replace it? (y/N): ');
  if (answer.toLowerCase() !== 'y') { console.log('Left .env unchanged.'); process.exit(0); }
}

const anon = await ask('Supabase anon (public) key: ', { hidden: true });
const anonClaims = jwtClaims(anon);
if (!anonClaims || anonClaims.role !== 'anon' || !anonClaims.ref) {
  console.error('\nThat does not look like an anon key. Check Project Settings -> API.');
  process.exit(1);
}
const url = `https://${anonClaims.ref}.supabase.co`;

const service = await ask('Supabase service_role key (optional, press Enter to skip): ', { hidden: true });
let lines = [`VITE_SUPABASE_URL=${url}`, `VITE_SUPABASE_ANON_KEY=${anon}`];
if (service) {
  const claims = jwtClaims(service);
  if (!claims || claims.role !== 'service_role' || claims.ref !== anonClaims.ref) {
    console.error('\nThat is not the service_role key for the same project.');
    process.exit(1);
  }
  lines.push('', '# SERVER-ONLY: used by the /api functions. Never prefix with VITE_.',
    `SUPABASE_URL=${url}`, `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    `GITHUB_WEBHOOK_SECRET=${randomBytes(32).toString('hex')}`);
}
writeFileSync(target, lines.join('\n') + '\n', { mode: 0o600 });
console.log(`\nWrote .env (project ${anonClaims.ref}). It is gitignored. Restart the dev server to load it.`);
