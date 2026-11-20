# FDOMAIN Multi-Language (`locales/*.json`) Design

- **Issue**: [#3](https://github.com/xuanhao1804/FDOMAIN/issues/3)
- **Date**: 2026-11-20
- **Status**: Approved (`cho bạn quyết tối ưu nhé`)

## 1. Intent & Goals
Add scalable multi-language support (i18n) using standard nested JSON locale catalogs, starting with **Vietnamese (`vi`, default)** and **English (`en`)** across the full FDOMAIN Next.js portal (`/`, `/directory`, `/claim`, `/health`, navigation shell, Admin modal, delete confirmation modal, status badges, and inline form validation).

## 2. Approaches Considered & Choice
1. **Standard `site/src/locales/*.json` + zero-dependency typed loader + SSR cookie (`fdomain_locale`) (Chosen)**
   - Keeps clean bookmarkable URLs (`/`, `/claim?domain=...`, `/directory`, `/health`) without `[locale]` route rewrites or extra dependencies.
   - Server reads `fdomain_locale` cookie in `RootLayout` so SSR renders `<html lang="vi|en">` and localized text immediately (zero flash of English before hydration).
   - Client `I18nProvider` switches languages instantaneously in memory, persists the cookie (`Max-Age=31536000; SameSite=Lax; Path=/`), updates `document.documentElement.lang`, and updates page `<title>` cleanly.
   - TypeScript infers strict dotted keys from `en.json` via `resolveJsonModule: true`, reinforced by a Vitest key & `{placeholder}` parity test so adding future locales (`ja.json`, `ko.json`, etc.) catches missing keys or mismatched placeholders automatically.
2. **`next-intl` with cookie mode (`messages/*.json`)**: Adds an extra runtime package and `next.config.ts` plugin when ICU pluralization/formatting is not needed yet.
3. **URL-prefixed routing (`/vi/...`, `/en/...`)**: Unnecessary URL churn for a personal DNS tool.

## 3. Architecture & Layout-Stability Guarantees
- **Catalogs**: `site/src/locales/en.json` and `site/src/locales/vi.json` with shared nested namespaces (`meta`, `common`, `nav`, `admin`, `status`, `domains`, `overview`, `directory`, `claim`, `health`).
- **Engine**:
  - `site/src/lib/i18n/config.ts`: `SUPPORTED_LOCALES = ["vi", "en"] as const`, `DEFAULT_LOCALE = "vi"`, `LOCALE_COOKIE_NAME = "fdomain_locale"`, cookie parser/validator.
  - `site/src/lib/i18n/messages.ts`: typed `MessageKey`, `translate(locale, key, params?)`, and helper for known provider notes (`namecom`, `namecheap-manual`, fallback to raw `dom.note`).
  - `site/src/lib/i18n/server.ts`: `getRequestLocale()` via `cookies()` from `next/headers`.
  - `site/src/components/i18n-context.tsx`: `I18nProvider`, `useI18n()`, and `LanguageSwitcher` (`role="group"`, `aria-pressed`, `lang="vi"`/`lang="en"` on individual buttons, fixed button dimensions).
- **Zero Layout Shift across `vi` ↔ `en`**:
  - Language switcher pill uses fixed `min-w` per toggle button (`VI` / `EN`) in top bar and sidebar/mobile drawer.
  - `CopyButton` widens `minInlineSize` to accommodate both `Copy`/`Copied` and `Sao chép`/`Đã chép` with `0px` resize.
  - Fixed-height slots on `/claim` (`min-h`) and `/directory` are checked in both `vi` and `en` on Desktop (`1440×900`) and Mobile (`390×844`).
- **Testing**: `tests/i18n.test.ts` checks 100% key parity, non-empty values, `{placeholder}` variable parity across all `site/src/locales/*.json`, interpolation, and cookie parsing.
