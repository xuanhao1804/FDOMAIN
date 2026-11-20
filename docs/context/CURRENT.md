# Current State

- **Active Outcome**: Warm Minimalist Editorial Bento redesign with shadcn/ui, Phosphor icons, Light/Dark theme toggle, and official `next-intl` ([#4](https://github.com/xuanhao1804/FDOMAIN/issues/4)) on top of FDOMAIN v2 ([#2](https://github.com/xuanhao1804/FDOMAIN/issues/2)).
- **Status**: `COMPLETED` (Implemented, verified, ready to push to `origin/main`).
- **Branch**: `main`.
- **Last Verified**:
  - `npm test`: 7 files, 40 tests passed (`status-check`, `export-site-data`, `drift-guard`, `schema-compiler`, `pr-validator`, `i18n`, `v2-multidomain-api`).
  - `npm run typecheck` & `npm --prefix site run typecheck`: passed.
  - `npm run validate`: 0 subdomain files, 0/180 DNS records (`domains/.gitkeep`).
  - `npm run site:build`: built `next-intl` + Google Fonts (`Newsreader`, `Be Vietnam Pro`, `JetBrains Mono`) across all routes (`/`, `/claim`, `/directory`, `/health`, `/api/*`, `/icon.svg`).
  - Browser verification (`http://localhost:3000`): Desktop `1440x900` and Mobile `390x844` across `/`, `/claim`, `/directory`, and `/health` — verified Light & Dark Mode via `ThemeToggle` (`<meta name="color-scheme">`), Radix `LanguageSwitcher` (`VI` ↔ `EN`) with SSR `NEXT_LOCALE` reload persistence, Faux-OS DNS preview window, Admin `<dialog>` (`Hiện`/`Ẩn` `0px`), zero horizontal overflow, zero console/HTTP errors, and exact `0px` delta across `.harrylee.dev` ↔ `.vinamuse.store`, all 4 presets, blur validation error, long subdomain, and `Copy` (`Sao chép` → `Đã chép`).
- **External User Setup Needed on Vercel**:
  - Set Vercel Project `fdomain` → **Settings → General → Root Directory** = `site` (Framework Preset = `Next.js`).
  - Add Environment Variables: `ADMIN_PASSWORD`, `SESSION_SECRET`, `NAMECOM_USERNAME`, `NAMECOM_TOKEN` (and optional `CLOUDFLARE_API_TOKEN`).
- **Next Action**: Set `Root Directory = site` and env vars on Vercel, then test live auto-DNS on `https://fdomain.vercel.app/`.
