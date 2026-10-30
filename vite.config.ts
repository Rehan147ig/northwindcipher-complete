import { defineConfig, loadEnv, type Plugin } from 'vite';
import { buildSync } from 'esbuild';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'));
// The Supabase anon key is public by design. Hosts that refuse a VITE_-prefixed name may provide it as
// SUPABASE_ANON_KEY instead; it is then injected under the name the app reads. A service-role key is refused.
function hostAnonKey(): string {
  const value = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!value) return '';
  try {
    const role = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')).role;
    if (role === 'service_role') throw new Error('refusing to build: a service_role key was supplied as the anon key');
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('refusing')) throw e;
  }
  return value;
}
const anonKey = hostAnonKey();

const define = {
  __APP_VERSION__: JSON.stringify(pkg.version),
  'process.env': {},
  ...(anonKey ? { 'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(anonKey) } : {})
};

// Dev-only: serve ./api/*.ts (the Vercel functions) from the Vite dev server so auth-gated flows work locally.
// Each request bundles the handler with esbuild (no `define` rewriting) and runs it in this process.
function apiDevServer(): Plugin {
  return {
    name: 'api-dev-server',
    apply: 'serve',
    configureServer(server) {
      const env = loadEnv('development', __dirname, '');
      for (const k of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GITHUB_WEBHOOK_SECRET', 'VITE_SUPABASE_URL']) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      server.middlewares.use(async (req, res, next) => {
        const match = /^\/api\/([a-z][a-z-]*)(\?.*)?$/.exec(req.url || '');
        if (!match) return next();
        try {
          const out = buildSync({
            entryPoints: [resolve(__dirname, 'api', `${match[1]}.ts`)], bundle: true, write: false,
            platform: 'node', format: 'cjs', external: ['@supabase/supabase-js'], logLevel: 'silent'
          });
          const mod: { exports: { default?: (q: unknown, r: unknown) => Promise<void> } } = { exports: {} };
          new Function('require', 'module', 'exports', out.outputFiles[0].text)(require, mod, mod.exports);
          if (!mod.exports.default) throw new Error('no handler');
          await mod.exports.default(req, res);
        } catch {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end('{"ok":false,"error":"not_found"}');
        }
      });
    }
  };
}

export default defineConfig({
  define,
  root: resolve(__dirname, 'src/renderer'),
  // .env lives at the repo root, not under the renderer root.
  envDir: __dirname,
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: { index: resolve(__dirname, 'src/renderer/index.html') },
      output: {
        // Long-lived vendor chunks cache across deploys; the community route lazy-loads pixi + supabase.
        manualChunks: {
          react: ['react', 'react-dom'],
          pixi: ['pixi.js'],
          supabase: ['@supabase/supabase-js']
        }
      }
    }
  },
  plugins: [react(), apiDevServer()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer/src'),
      '@brand': resolve(__dirname, 'docs'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  }
});
