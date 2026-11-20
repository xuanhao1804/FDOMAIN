# FDOMAIN Warm Minimalist Editorial Bento Redesign & `next-intl` Upgrade

- **Issue**: [#4](https://github.com/xuanhao1804/FDOMAIN/issues/4)
- **Date**: 2026-11-20
- **Status**: Approved (`chắc vibe 2, nhưng làm bắt mắt hơn chut nhé`)

## 1. Visual Direction (Warm Minimalist Bento — Refined & Eye-Catching)
- **Palette**: Warm bone canvas (`#F7F6F3` light / `#141413` dark), crisp white/warm-paper cards (`#FFFFFF` / `#FBFBF9` light; `#1C1C1A` dark), `1px` hairline borders (`#E5E4DF` / `#2D2D29`), off-black charcoal text (`#161614` / `#F5F4F0`) and muted warm stone (`#6E6C67` / `#A19E97`).
- **Spot Pastels & Editorial Depth** ("bắt mắt hơn chút" without breaking minimalism):
  - Subtle dot/architectural line grid overlay (`opacity: 0.045`) and ultra-soft ambient warm radial highlight behind the Overview hero Bento card.
  - Faux-OS window chrome bar (3 muted control dots + monospace `DNS RECORD PREVIEW · <domain>`) framing the live DNS generator output panel on `/claim`.
  - Muted pastel semantic accents paired with **duotone Phosphor Icons** (`@phosphor-icons/react`): Sage Green (`#EDF3EC` / `#2A603B`), Slate Cobalt (`#E6F1FA` / `#1D5F92`), Warm Amber (`#FBF3DB` / `#8F5A00`), Terracotta Rose (`#FDEBEC` / `#9F2F2D`).
  - Crisp radii (`6px`–`8px` controls, `12px` bento cards; `rounded-full` reserved strictly for tiny uppercase status tags/badges).
  - Subtle `translateY(10px)` staggered reveal animation (`cubic-bezier(0.16, 1, 0.3, 1)`) and ultra-subtle `0 2px 10px rgba(0,0,0,0.04)` hover lift.
- **Typography (`next/font/google` with full Vietnamese support)**:
  - Display Editorial Serif: `Newsreader` (tight tracking `-0.025em`, `line-height: 1.1`)
  - UI Geometric Sans: `Be Vietnam Pro` (no Inter/Roboto/Open Sans)
  - Monospace Code/DNS: `JetBrains Mono`

## 2. Framework Architecture
- **UI Primitives (`site/src/components/ui/`)**: shadcn/ui architecture (`cn()` via `clsx` + `tailwind-merge`, `cva` variants, `@radix-ui/react-slot`, `@radix-ui/react-dropdown-menu`, `@phosphor-icons/react` bold/duotone weights).
  - `button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `dropdown-menu.tsx`, `theme-toggle.tsx`, `language-switcher.tsx`.
- **Official `next-intl` (Cookie Mode, Clean URLs)**:
  - Standard message catalogs at `site/messages/vi.json` and `site/messages/en.json` (default `vi`).
  - `site/src/i18n/request.ts` (`getRequestConfig` reading `NEXT_LOCALE` cookie via `await cookies()`).
  - `site/next.config.ts` wrapped with `createNextIntlPlugin('./src/i18n/request.ts')`.
  - Server Action `site/src/app/actions/locale.ts` persisting `NEXT_LOCALE` cookie and refreshing router via `revalidatePath("/", "layout")` + `router.refresh()`.
  - `NextIntlClientProvider` in `site/src/app/layout.tsx` feeding `useTranslations()` across all client views and `getTranslations()` in Server `generateMetadata()`.
- **Theme Switcher**: Two-state `light` / `dark` / system-revert toggle driven by `<meta name="color-scheme">` + inline FOUC-prevention script + CSS `light-dark()` and `:root:has(> head > meta[name="color-scheme"][content="..."])`.
- **Zero Layout Shift**: Preserve exact `0px` stability on `/claim` & `/directory` across `vi`/`en`, `.harrylee.dev` ↔ `.vinamuse.store`, all 4 presets, inline errors, long subdomains, Copy toggle, and mobile `390×844` header.
