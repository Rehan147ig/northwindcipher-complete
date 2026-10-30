// Applies supabase/migrations to a throwaway Postgres (Docker) and runs supabase/tests/rls.sql.
// In CI a Postgres service container is used instead: set RLS_DATABASE_URL and psql must be on PATH.
import { execFileSync, spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase');
const migrations = readdirSync(join(root, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
const files = [join(root, 'tests', 'setup.sql'), ...migrations.map((f) => join(root, 'migrations', f)), join(root, 'tests', 'rls.sql')];
const sql = files.map((f) => readFileSync(f, 'utf8')).join('\n');

const url = process.env.RLS_DATABASE_URL;
let result;
if (url) {
  result = spawnSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql, encoding: 'utf8' });
} else {
  const name = `nw-rls-${process.pid}`;
  try {
    try {
      execFileSync('docker', ['run', '-d', '--rm', '--name', name, '-e', 'POSTGRES_PASSWORD=test', 'postgres:16-alpine'], { stdio: 'ignore' });
    } catch {
      console.error('Could not start Postgres in Docker. Start Docker, or set RLS_DATABASE_URL to a throwaway database.');
      process.exit(2);
    }
    for (let i = 0; i < 40; i++) {
      if (spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres']).status === 0) break;
      spawnSync('node', ['-e', 'setTimeout(()=>{},500)']);
    }
    result = spawnSync('docker', ['exec', '-i', name, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'], { input: sql, encoding: 'utf8' });
  } finally {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' });
  }
}
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
process.exit(result.status ?? 1);
