# Current State

- **Active Outcome**: FDOMAIN v2 Multi-Domain Fullstack Portal & Auto-DNS ([#2](https://github.com/xuanhao1804/FDOMAIN/issues/2)).
- **Status**: `COMPLETED` (Implemented, verified, committed, pushed to `origin/main` so Vercel auto-deploys on push).
- **Branch**: `main`.
- **Last Verified**:
  - `npm test`: 6 files, 37 tests passed (`status-check`, `export-site-data`, `drift-guard`, `schema-compiler`, `pr-validator`, `v2-multidomain-api`).
  - `npm run typecheck` & `npm --prefix site run typecheck`: passed.
  - `npm run validate`: 0 subdomain files, 0/180 DNS records (`domains/.gitkeep` only — sample seed files removed).
  - `npm run site:build`: exported empty `registry.json` (`0` entries) and built all dynamic routes (`/claim`, `/directory`, `/api/*`) + static pages (`/`, `/health`, `/icon.svg`).
  - Browser verification (`http://localhost:3000`): Desktop `1440x900` and Mobile `390x844` across `/`, `/claim`, `/directory`, and `/health` — verified zero horizontal overflow, zero console/network errors, `input.sr-radio` stays `1x1` clipped, `0px` layout shift across domains/presets/validation/Copy, and clean empty states across `/`, `/directory`, and `/health` after removing sample seed entries (`prefers-color-scheme: dark` emulation unavailable in headless webview).
- **External User Setup Needed on Vercel**:
  - Set Vercel Project `fdomain` → **Settings → General → Root Directory** = `site` (Framework Preset = `Next.js`).
  - Add Environment Variables: `ADMIN_PASSWORD`, `SESSION_SECRET`, `NAMECOM_USERNAME`, `NAMECOM_TOKEN` (and optional `CLOUDFLARE_API_TOKEN`).
- **Next Action**: Set `Root Directory = site` and env vars on Vercel, then test live auto-DNS on `https://fdomain.vercel.app/`.
