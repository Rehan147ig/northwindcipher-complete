# Northwindcipher Community

Contributor community website for [Northwind-Cipher/cool-sdk](https://github.com/Northwind-Cipher/cool-sdk), with a pixel-art office walkthrough, public GitHub activity, Supabase contributor accounts, and Vercel server APIs.

## Development

Requires Node.js 22 or newer.

```sh
npm ci --ignore-scripts
cp .env.example .env.local
npx vite --host 127.0.0.1 --port 5199
```

Configure your own Supabase project using `supabase/setup-all.sql`, then fill in `.env.local`. Keep service keys server-only. Configure the public website URL and confirmation redirect paths in Supabase Auth.

## Office artwork and character showcase

This private repository includes all three original tileset images and the character showcase at `docs/community/avatars/character-showcase.png`.

![Character showcase](docs/community/avatars/character-showcase.png)

The bundled LimeZu artwork is separately licensed. Keep this repository private; do not redistribute its raw assets. Preserve `LICENSE-ASSETS`, the original asset license and attribution notices, and visible credit to [LimeZu](https://limezu.itch.io/).

## Validation and deployment

```sh
npm run typecheck:web
npm run typecheck:api
npm run test:community
npm run build:web
```

Import the repository into Vercel; `vercel.json` supplies the web build and API configuration. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and server-only `SUPABASE_SERVICE_ROLE_KEY` in Vercel. GitHub webhook synchronization additionally requires repository enrollment and `GITHUB_WEBHOOK_SECRET`.

Characters and sample room activity are simulations. Public GitHub reads are real. An empty database needs its migrations applied before account features work. See `docs/community/SETUP.md` for the full runbook.

## Credits and license

Adapted from [Munder Difflin](https://github.com/HarnessMD/munder-difflin). The original MIT copyright notice is preserved in `LICENSE`. Art has separate terms described above. No environment credentials or Vercel account metadata are included.
