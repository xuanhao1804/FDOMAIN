# Current State

- **Active Outcome**: FDOMAIN v2 Multi-Domain Fullstack Portal & Auto-DNS ([#2](https://github.com/xuanhao1804/FDOMAIN/issues/2)).
- **Status**: `COMPLETED` (Implemented, verified, committed, pushed to `origin/main` so Vercel auto-deploys on push).
- **Branch**: `main`.
- **Last Verified**:
  - `npm test`: 6 files, 37 tests passed (`status-check`, `export-site-data`, `drift-guard`, `schema-compiler`, `pr-validator`, `v2-multidomain-api`).
  - `npm run typecheck` & `npm --prefix site run typecheck`: passed.
  - `npm run validate`: 2 subdomain files valid, 2/180 DNS records.
  - `npm run site:build`: exported multi-domain `registry.json` and built all dynamic routes (`/claim`, `/directory`, `/api/*`) + static pages (`/`, `/health`, `/icon.svg`).
  - Browser verification (`http://localhost:3000`): Desktop `1440x900` and Mobile `390x844` across `/`, `/claim?domain=vinamuse.store`, `/directory`, and `/health` — verified dynamic `.vinamuse.store` / `.harrylee.dev` suffix switcher, deferred inline validation, reserved checkbox, live DoH lookup HTTP `200`, Admin `<dialog>` modal (`Esc` + show/hide toggle), mobile drawer, zero horizontal overflow, and zero console/network errors (`prefers-color-scheme: dark` emulation unavailable in headless webview).
- **External User Setup Needed on Vercel**:
  - Set Vercel Project `fdomain` → **Settings → General → Root Directory** = `site` (Framework Preset = `Next.js`).
  - Add Environment Variables: `ADMIN_PASSWORD`, `SESSION_SECRET`, `NAMECOM_USERNAME`, `NAMECOM_TOKEN` (and optional `CLOUDFLARE_API_TOKEN`).
- **Next Action**: Set `Root Directory = site` and env vars on Vercel, then test live auto-DNS on `https://fdomain.vercel.app/`.
