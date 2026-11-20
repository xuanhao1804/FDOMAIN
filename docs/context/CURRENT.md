# Current State

- **Active Outcome**: Multi-language i18n with standard `site/src/locales/{vi,en}.json` ([#3](https://github.com/xuanhao1804/FDOMAIN/issues/3)) completed on top of FDOMAIN v2 ([#2](https://github.com/xuanhao1804/FDOMAIN/issues/2)).
- **Status**: `COMPLETED` (Implemented, verified, ready to push to `origin/main`).
- **Branch**: `main`.
- **Last Verified**:
  - `npm test`: 7 files, 41 tests passed (`status-check`, `export-site-data`, `drift-guard`, `schema-compiler`, `pr-validator`, `i18n`, `v2-multidomain-api`).
  - `npm run typecheck` & `npm --prefix site run typecheck`: passed.
  - `npm run validate`: 0 subdomain files, 0/180 DNS records (`domains/.gitkeep` only — sample seed files removed).
  - `npm run site:build`: exported empty `registry.json` (`0` entries) and built all dynamic routes (`/`, `/claim`, `/directory`, `/health`, `/api/*`) + static assets (`/icon.svg`, `/_not-found`).
  - Browser verification (`http://localhost:3000`): Desktop `1440x900` and Mobile `390x844` across `/`, `/claim`, `/directory`, and `/health` — verified default `vi` SSR (`html[lang="vi"]`), instant `VI ↔ EN` switch & reload cookie persistence, localized `<title>`, localized Admin `<dialog>` modal (`Hiện`/`Ẩn` `0px` shift), zero horizontal overflow with `VI|EN` header switcher, and exact `0px` delta across `.harrylee.dev` ↔ `.vinamuse.store`, all 4 presets, blur validation error, long subdomain, and `Copy` (`Sao chép` → `Đã chép`) (`prefers-color-scheme: dark` emulation unavailable in headless webview).
- **External User Setup Needed on Vercel**:
  - Set Vercel Project `fdomain` → **Settings → General → Root Directory** = `site` (Framework Preset = `Next.js`).
  - Add Environment Variables: `ADMIN_PASSWORD`, `SESSION_SECRET`, `NAMECOM_USERNAME`, `NAMECOM_TOKEN` (and optional `CLOUDFLARE_API_TOKEN`).
- **Next Action**: Set `Root Directory = site` and env vars on Vercel, then test live auto-DNS on `https://fdomain.vercel.app/`.
