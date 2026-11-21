# FDOMAIN UX Radical Simplification: Minimal Home Form, Availability Check & Popup Creator

Date: 2026-11-21
Status: Approved (incorporating user feedback: keep all 4 sidebar items, simplify `/claim` form, ensure thorough Dark Mode craft)

## 1. Intent & Why

Although FDOMAIN v2 works end-to-end (Name.com Core API auto-DNS, Namecheap copy helper, DoH checks, VI/EN `next-intl`, Light/Dark mode, zero layout shift, Singapore `sin1`), the current UI overwhelms non-technical users:

- **Home (`/`) duplicates every other page:** It displays 10+ cards, repeats the "Create Subdomain" CTA in 6 places, mirrors the sidebar links as 3 feature cards, and prominently displays an empty `0/180` Git Registry state even when the owner manages records live via Name.com.
- **Developer jargon sits on the front page:** Terms like `CNAME`, `A`, `TXT`, `DoH`, `Core API`, `BasicDNS`, `NS`, `Registry`, `repo`, `TTL`, and `Env` immediately intimidate users without a coding background.
- **Sidebar & Header carry unnecessary noise:** The persistent `Hạn mức DNS 0/180` widget and redundant header `+ Tạo Subdomain` button add visual clutter to every view.

**Core goal:** Give every sidebar section one crisp, non-overlapping responsibility so a non-coder can open FDOMAIN, understand it in 3 seconds, type the subdomain they want, pick a root domain, and finish in a calm guided popup.

## 2. Goals, Non-Goals & Anti-Goals

### Goals
1. **Ultra-minimal Home (`/`):** Full-height centered canvas with a refined editorial ambient background and **only one focal form** (subdomain input + root domain selector + `Tiếp tục` / `Continue` button + quiet reserved status line).
2. **Check-on-Submit availability:** Pressing `Tiếp tục` (or `Enter`) calls a dedicated server endpoint `GET /api/dns/availability` that checks format, protected/reserved rules, Git registry entries, live provider API records (Name.com / Cloudflare), and DoH fallback (Namecheap manual zones) — without leaking protected record values to public callers.
3. **Guided Popup Creator (`<dialog>`):** When the requested subdomain is available, immediately open a calm, single-column native modal (`SubdomainSetupDialog`) in plain human language to pick hosting platform, confirm destination, and either create immediately (Admin + Auto API) or copy 2 simple fields (Namecheap manual).
4. **Each sidebar page does strictly one job:**
   - **Trang chủ (`/`)**: Check & create a subdomain (1 centered form + popup).
   - **Danh sách (`/directory`)**: Browse, search, filter, verify, open, copy, and delete existing subdomains — hiding the empty Git Repo section when `entries.length === 0`.
   - **Hệ thống (`/health`)**: Technical & admin diagnostics only (Vercel env readiness, provider status, `0/180` quota, dead-subdomain scan results, GitHub alerts, and a link to the Advanced Builder `/claim`).
5. **Plain human copy first, technical details tucked away:** Move TXT verification, raw DNS table preview (`Host / Type / Value / TTL`), and GitOps PR JSON behind a collapsed `Tùy chọn nâng cao ▸` disclosure in the popup. Keep full `vi` + `en` parity in `site/messages/{vi,en}.json`.
6. **Preserve existing quality bars:** Zero layout shift (`0px` delta), instant sidebar navigation (`prefetch={true}` + optimistic highlight + Router Cache), Light & Dark themes, keyboard accessibility, and passing `npm test`, `typecheck`, `validate`, and `site:build`.

### Non-Goals
- Do not change DNS provider drivers (`namecom.ts`, `cloudflare.ts`), auth cookie mechanics (`ADMIN_PASSWORD` / `SESSION_SECRET`), or GitHub Actions workflows.
- Do not delete `/claim` route — retain it as an advanced/deep-link builder accessible from `/health` or the popup's advanced section so existing links and GitOps workflows never break.
- Do not add user accounts, databases, or new external UI libraries.

### Anti-Goals (Failure Conditions)
- Do not put feature showcase cards, stat boxes, or empty `0/180` Git Registry banners back onto Home (`/`).
- Do not check availability on every keystroke (causes premature errors and noisy API/DoH traffic).
- Do not expose private/unmanaged/TXT record values from `GET /api/dns/availability` to unauthenticated visitors.
- Do not break mobile usability (`390x844`) or introduce hydration/layout shifts when opening or submitting the popup.

## 3. Approaches Considered

| Approach | Summary | Trade-off | Decision |
| --- | --- | --- | --- |
| **A. Sidebar (3 focused pages) + Minimal Home Form + Popup Creator** | Keep clean persistent sidebar where each tab owns 1 job (`Trang chủ`, `Danh sách`, `Hệ thống`); Home `/` shows only 1 centered form on a refined editorial background; `Tiếp tục` checks availability and opens a modal popup if available. | Requires a small new `GET /api/dns/availability` API route and a dedicated `SubdomainSetupDialog`, while `/claim` becomes an advanced route rather than a duplicate sidebar tab. | **Selected** (directly matches user's stated architecture & mental model). |
| **B. Top-bar only + Inline Progressive Reveal on `/`** | Remove sidebar completely; expand Step 2 inline below the input on `/`. | Loses persistent left navigation that the user wants to keep cleanly organized per role, and expands vertical height on Home instead of keeping Home strictly a 1-form canvas. | Rejected. |
| **C. Redirect `/` → multi-step `/claim` wizard** | Home form submits via route navigation to `/claim?label=...&domain=...`. | Forces a full route jump for every single attempt; slower feel compared to checking in place and opening a popup only when available. | Rejected. |

## 4. Detailed Architecture & UX Design

### 4.1 App Shell, Sidebar & Header (`site/src/components/app-shell.tsx`)

- **Sidebar navigation (all 4 items retained, each with one crisp non-overlapping role):**
  1. `Trang chủ` / `Home` (`/`) — `House` icon — Ultra-clean 1-form subdomain checker + popup creator (fast entry for new & returning users).
  2. `Danh sách` / `Subdomains` (`/directory`) — `Stack` icon — Clean list of live web addresses, search, filter, verify, copy, delete (+ Admin technical toggle).
  3. `Tạo địa chỉ` / `Create Address` (`/claim`) — `PlusCircle` icon — Friendly full-form builder with live preview & optional GitHub PR mode.
  4. `Hệ thống` / `System` (`/health`) — `Heartbeat` icon — Technical & admin diagnostics only (API env, `0/180` quota, dead-subdomain probe).
- **Sidebar footer (de-cluttered):**
  - **Remove** the `Hạn mức DNS 0/180` card from the sidebar completely (quota lives solely on `/health`).
  - Replace the bulky Admin card with a **single compact status/action row** (`Admin · Đã mở` with Lock icon button, or `Mở khóa Admin` button when locked — fixed width, zero shift).
  - Keep the subtle `GitHub ↗` link beneath it.
- **Top Header (de-cluttered):**
  - Left: Mobile menu button (`lg:hidden`) + current route label.
  - Right: `ThemeToggle` + `LanguageSwitcher` (`VI/EN`).
  - **Remove** the redundant `+ Tạo Subdomain` button from `/` (keep subtle shortcut only on `/directory` / `/health` if helpful, or keep header minimal with Theme + Language).
- **Dark Mode craft (Light & Dark both first-class):**
  - Follow `modern-web-guidance` for `color-scheme` + `light-dark()` / surface elevation + WCAG AA contrast across every component: Home ambient background (dot grid, warm subtle glow, concentric rings), unified input bar, Radix dropdown popover, native `<dialog>` popup & backdrop, option cards, inputs, focus rings, badges, and skeletons.
  - Verify zero FOUC on reload, crisp border separation in dark mode (warm obsidian `#141413` canvas, `#1C1C1A` surface, `#242421` elevated controls, `#32322D` / `#4A4A43` borders), and true optical clarity in both themes.

### 4.2 Home Page `/` (`site/src/components/home-studio.tsx` replacing `overview-view.tsx`)

- **Layout & Ambient Editorial Background:**
  - `<main>` on `/` uses a centered flex container (`min-h-[calc(100dvh-3.5rem)]`) so the form sits optically centered (`~42%` from top) with generous breathing room and **no vertical scrolling on desktop (`1440x900`)**.
  - **Refined background (`.home-ambient-canvas` in `globals.css`)** adhering strictly to `minimalist-ui` (no neon gradients, no heavy shadows):
    - Fine architectural dot grid (`22px` spacing, `--dot-grid-color`) masked radially so it fades smoothly into `--bg-canvas` at all edges.
    - Soft warm editorial radial glow behind the form (`--hero-glow-color`, subtle terracotta/sand warmth in Light Mode, warm amber-obsidian tint in Dark Mode).
    - Subtle decorative hairline concentric rings (pure inline SVG, `pointer-events-none`, `aria-hidden="true"`, ~`0.05` opacity) centered behind the focal form to add crafted depth without visual noise.
- **Content (strictly minimal, `max-w-xl` / `max-w-2xl`):**
  1. **Headline (`Newsreader`, 36–44px):**
     - VI: `Chọn địa chỉ web của bạn.`
     - EN: `Pick your web address.`
  2. **1-line plain subtitle:**
     - VI: `Nhập tên ngắn bạn muốn và chọn đuôi tên miền để kiểm tra ngay.`
     - EN: `Type the short name you want and pick a domain ending to check right away.`
  3. **Single Unified Input Form:**
     - Clean elevated surface card (`rounded-xl`, `1px solid var(--border-color)`, focus-within border highlight).
     - Desktop (`sm:` and up): single horizontal row containing:
       - **Subdomain input** (`placeholder="vd: blog, shop, demo"`, auto-lowercase on submit, `spellCheck={false}`, `autoCapitalize="none"`, `autoCorrect="off"`).
       - **Domain selector** (Radix `DropdownMenu` trigger styled flush inside the bar: `.harrylee.dev ▾` with fixed min-width based on longest configured domain so switching domains never shifts the bar!). Dropdown lists every domain in `config.json` (`rootDomains[]`), displaying `.domain` + a plain 2-word tag based on actual live capability (`auto-ready` → `Tạo tự động` / `Auto`; `auto-needs-env` or `manual-copy` → `Sao chép nhanh` / `Copy`, so the UI never promises one-click auto-create when server credentials are missing).
       - **Primary submit button**: `Tiếp tục` + arrow icon (shows spinner + `Đang kiểm tra...` while calling `/api/dns/availability`, fixed `min-w` to prevent width jitter).
     - Mobile (`< 640px`): Input + domain selector on row 1, full-width `Tiếp tục` button on row 2 inside the same clean card.
  4. **Reserved Inline Feedback Slot (`min-h-[3.5rem]` below the form — zero shift):**
     - *Idle:* Quiet 1-line tip (`Chỉ dùng chữ thường, số và dấu gạch ngang.`).
     - *Invalid / Protected / Taken:* Clear plain-language message in muted red/amber (e.g., `blog.harrylee.dev đã được dùng. Hãy thử tên khác.`).
       - When `status === "taken"`, display up to **2 clickable suggestion chips** (e.g., `blog-app`, `my-blog`) generated client-side; clicking a chip fills the input and clears the error.
     - *Reserved (Admin unlocked):* Amber message (`Đây là tên hệ thống. Bạn vẫn có thể mở hộp thoại với quyền Admin.`) + inline button `Vẫn tiếp tục →` that opens the popup with `isReservedOverride = true`.
     - *Network / API Error:* Friendly retry message without breaking form state.

### 4.3 Availability Check API (`GET /api/dns/availability`)

New server route `site/src/app/api/dns/availability/route.ts` backed by a pure, unit-testable helper `site/src/lib/availability.ts`:

- **Query params:** `?domain=<rootDomain>&label=<subdomainLabel>`
- **Response schema (JSON):**
  ```ts
  type AvailabilityStatus =
    | "available"
    | "taken"
    | "reserved"
    | "protected"
    | "invalid"
    | "unverified";

  interface AvailabilityResponse {
    available: boolean;
    status: AvailabilityStatus;
    fqdn: string;
    domain: string;
    label: string;
    canOverride: boolean; // true only when status === "reserved" && isAdmin
    source: "validation" | "registry" | "live-api" | "doh" | "doh-fallback" | "doh-error";
    providerMode: "auto-ready" | "auto-needs-env" | "manual-copy";
  }
  ```
- **Deterministic Evaluation Order (with public security short-circuit & provider fallback):**
  1. Verify `domain` exists in `config.json` `rootDomains[]` (else `400`).
  2. Normalize `label = label.trim().toLowerCase()`. Check `isValidSubdomainLabel(label)` and `fqdn.length <= 253` → if invalid, return `200` with `status: "invalid", source: "validation"`.
  3. Check hard-lock (`label === "@"` or `getHardLockReason(label, "CNAME", "check.example", data.unmanaged) !== null`) → return `200` with `status: "protected", source: "validation"`.
  4. **Public security short-circuit on reserved labels (`!isAdmin`):** If `!isAdmin` and `isReservedSubdomainLabel(label, data.reservedLabels)`, immediately return `200` with `{ available: false, status: "reserved", canOverride: false, source: "validation" }` **before** querying live provider APIs or DoH (prevents exposing a boolean existence oracle for redacted infrastructure/TXT hosts and avoids unnecessary upstream calls).
  5. Check Git registry `data.entries` for matching `(rootDomain, label)` → if present, return `200` with `status: "taken", source: "registry"`.
  6. Check live existence (runs for all non-reserved labels, and for reserved labels **only when `isAdmin === true`** so an Admin checking a reserved name that already exists sees `taken` rather than misleadingly `reserved`):
     - **If `auto-ready` (`namecom` / `cloudflare-*`):**
       - Check authoritative live provider records via a server-side host-presence check (`listNamecomRecords` / `listCloudflareRecords`, backed by a short 30s in-memory server cache of lowercase host names per domain — invalidated on create/delete via `invalidateDomainCache`). Checks if any existing record has `host === label` (covering `A`, `AAAA`, `CNAME`, `TXT`, etc.) **without returning any record values to the client**. If matched → `status: "taken", source: "live-api"`.
       - **If provider API throws** (timeout, 5xx, rate limit, auth error): fall back to parallel DoH (`lookupLiveDns(fqdn, "CNAME")` and `lookupLiveDns(fqdn, "A")`).
         - If DoH returns `found` → `200` with `{ available: false, status: "taken", source: "doh" }`.
         - If DoH returns `nxdomain`/`empty` → `200` with `{ available: true, status: "unverified", source: "doh-fallback" }` (allows opening popup with a gentle note that live API check fell back to public DNS).
         - If DoH **also** fails → return HTTP `502` with `{ error: "..." }` so Home displays an inline retry message instead of opening the popup blind.
     - **If `manual-copy` (`namecheap-manual`) or `auto-needs-env`:** Query `lookupLiveDns(fqdn, "CNAME")` and `lookupLiveDns(fqdn, "A")` in parallel.
       - If either returns `status === "found"` → `200` with `status: "taken", source: "doh"`.
       - If both throw → mark `dohFailed = true`.
  7. **Admin reserved check:** If `isAdmin` and `isReservedSubdomainLabel(label, data.reservedLabels)`, return `200` with `{ available: false, status: "reserved", canOverride: true, source: "validation" }`. *(Client note: if the user unlocks Admin while viewing a stale public `reserved` message on Home, Home clears the stale result so clicking `Tiếp tục` re-queries cleanly as Admin.)*
  8. If `dohFailed`: return `200` with `{ available: true, status: "unverified", canOverride: false, source: "doh-error" }` (lets the user proceed into the popup with a subtle note that live DNS lookup timed out).
  9. Otherwise: return `200` with `{ available: true, status: "available", canOverride: false, source }`.
- **Observability:** Emit `@vercel/functions` `metric("fdomain.dns_availability", 1, { status, source })` and duration metric matching existing routes.
- **Security:** Public callers receive only boolean availability + status enum — zero record IPs, targets, TXT secrets, or provider internals.

### 4.4 Setup & Create Popup (`site/src/components/subdomain-setup-dialog.tsx`)

Lazy-loaded (`next/dynamic`, `ssr: false`) native `<dialog className="editorial-modal editorial-modal-wide">` (`width: min(94vw, 33rem)`), preloaded on Home input focus so opening has `0ms` delay. Supports `Esc`, backdrop click (`closedby="any"` + fallback), and clean focus management.

#### State 1 — Setup Form (Single Column, Plain Language)
- **Header:** Green `CheckCircle` icon + monospace **`<label>.<domain>`** + badge `Đang trống` (`Available`) + close `X` button.
  - If `status === "unverified"`, show subtle amber note: *"Không thể kiểm tra trực tuyến lúc này — bạn vẫn có thể tiếp tục."*
  - If Admin reserved override, show explicit confirmation checkbox at the top.
- **Section 1 — Hosting Platform ("Trang web của bạn đang đặt ở đâu?"):**
  - 4 clean tactile buttons in a 2×2 grid (`Vercel`, `GitHub Pages`, `Netlify`, `Máy chủ riêng`).
  - Selecting a preset smartly pre-fills the destination input (`cname.vercel-dns.com`, `ten-ban.github.io`, `ten-web.netlify.app`, or IPv4 placeholder) and updates the 1-line human hint.
- **Section 2 — Destination Input ("Địa chỉ trang web / máy chủ đích"):**
  - Single crisp input with plain-language label & 1-line human helper (no `CNAME` / `IPv4` jargon in the primary label; show technical record type only as a quiet muted pill or inside Advanced).
  - Real-time format validation on blur/submit with friendly Vietnamese/English error messages.
- **Section 3 — Collapsed `Tùy chọn nâng cao ▸` (`<details>` closed by default):**
  - Optional verification code (`Mã xác minh Vercel` or `Mã xác minh TXT` + prefix).
  - Compact copyable DNS record preview (`Host`, `Type`, `Value`) for power users.
  - Subtle link: `Mở trình tạo nâng cao / GitHub PR ↗` → `/claim?domain=...&label=...`.
- **Footer / Action Area:**
  - **Auto-ready domain (`providerMode === "auto-ready"`, e.g. `harrylee.dev`) + Admin configured & unlocked:**
    - Primary button: **`Tạo địa chỉ ngay`** → `POST /api/dns/records` → invalidates client `liveRecordsCache` + switches modal to **State 2 (Success)**.
  - **Auto-ready domain + Admin configured (`ADMIN_PASSWORD` set) & locked:**
    - Clear 1-line note (*"Cần đăng nhập quản trị để tự động tạo địa chỉ này."*).
    - Primary button: **`Mở khóa quản trị để tạo`** → opens `AdminLoginDialog`; once unlocked, the setup popup stays open (or cleanly re-opens) with state preserved and immediately switches to **`Tạo địa chỉ ngay`**!
    - Secondary text button: `Xem thông số để tự copy` (expands the copyable records section).
  - **Manual domain (`providerMode === "manual-copy"`, e.g. `vinamuse.store`) OR unconfigured Auto-API (`providerMode === "auto-needs-env"` or `!adminConfigured`):**
    - Degrades gracefully into a **registrar-agnostic 2-step plain-language Copy Guide** directly inside the popup (dynamically referencing `activeDomainMeta.registrar`, e.g., `Namecheap`, `Name.com`, or `Cloudflare`, never hardcoded to Namecheap!):
      1. Copy **Tên (Host)** & **Giá trị (Value)** via 1-click Copy buttons (plus optional TXT row if entered).
      2. Paste into `{registrar}` DNS settings (with exact short path hint for Namecheap BasicDNS when `dnsProvider === "namecheap-manual"`).
    - When degraded due to missing server env (`auto-needs-env` or `!adminConfigured`), display a quiet 1-line admin note linking to **`Hệ thống →`** (`/health`) to enable 1-click auto-create.
    - Footer action: **`Kiểm tra đã hoạt động chưa`** (calls `/api/dns/lookup`, displays plain human result: *"Đã hoạt động!"* or *"Chưa nhận — hãy đợi 1–2 phút rồi kiểm tra lại"*).

#### State 2 — Success View (after Auto-API Creation)
- Calm success header: green `CheckCircle` + **`Đã tạo địa chỉ thành công!`**
- Highlighted URL card: clickable `https://<label>.<domain> ↗` + 1-click `Sao chép link` button.
- Friendly note: *"Địa chỉ mới thường sẵn sàng sau 1–3 phút."*
- Inline **`Kiểm tra kết nối`** button (live DoH probe with plain-language status).
- Footer buttons: **`Xem trong Danh sách`** (`/directory?domain=...`) + **`Tạo địa chỉ khác`** (closes dialog, clears Home input, focuses input).

### 4.5 Simplifying `/directory` & `/health` (Each Page Does One Job)

- **`Danh sách` (`/directory`):**
  - Title & subtitle rewritten in plain human language (*"Danh sách địa chỉ"* — *"Xem, tìm kiếm, kiểm tra hoạt động hoặc xóa các địa chỉ đã tạo."*).
  - Hide the confusing empty *"Subdomain theo dõi trong Repo"* card completely when `entries.length === 0` (render it only if Git-tracked entries actually exist!).
  - Simplify filter bar: domain chips (`Tất cả`, `.harrylee.dev`, `.vinamuse.store`) + clean search bar. Hide the status filter pills (`Hoạt động / Cảnh báo / Lỗi / Chờ kiểm tra`) when there are `0` Git-tracked health entries so non-coders don't click filters that don't apply to live records!
  - **Default clean web-address view + Admin technical records toggle:**
    - By default, show **web subdomain records** (`A`, `AAAA`, `CNAME`, non-protected) as clean, human-friendly rows: clickable `https://<fqdn> ↗` link, destination target, **`Sao chép link`** (copies `https://<fqdn>`, matching the Success popup!), **`Kiểm tra`** (instead of `Kiểm tra DoH`), and **`Xóa`** (Admin).
    - When Admin is unlocked and non-web/system records exist (`TXT`, `MX`, `NS`, apex `@`, protected), show a compact toggle pill in the list header: **`Hiện bản ghi kỹ thuật (N)`** (`Show technical records (N)`, **OFF by default**). Turning it ON reveals those system/TXT rows with their record type/TTL/`Được bảo vệ` badges, where `Sao chép` copies the raw `rec.value` (since non-web records are not website URLs) and deletable non-protected TXTs still expose `Xóa`.
- **`Hệ thống` (`/health`):**
  - Houses all technical/admin status: root domains, Vercel env readiness (`ADMIN_PASSWORD`, `NAMECOM_*`, `CLOUDFLARE_*`), DNS quota `0/180` (moved out of Sidebar!), GitOps scan diagnostics, GitHub alert issues, plus a clean link card to **`Trình tạo nâng cao & GitHub PR`** (`/claim`).
- **`/claim` (`Tạo địa chỉ` — Friendly Full Builder):**
  - Kept in Sidebar and redesigned to feel calm and friendly for non-coders:
    - Domain cards use plain human subtitles (*"Tạo tự động chỉ 1 chạm"* vs *"Sao chép nhanh vào Namecheap"*) — no truncated `BasicDNS / Core API / trỏ NS sang...` jargon.
    - Clean single-column destination input (no cramped 2-column squeeze with `vc-domain-verify=...` exposed by default).
    - Optional TXT / Vercel verification tucked into a collapsed **`Mã xác minh (tùy chọn) ▸`** disclosure.
    - Right panel leads with a friendly live address preview (`https://<label>.<domain>`) + **`Kiểm tra hoạt động`** button + crisp copyable connection rows, with GitOps PR JSON tucked cleanly below.
    - Accepts optional `?domain=...&label=...` query params from `/directory` or the Home popup's Advanced link.

## 5. Verification & Testing Plan

- **Unit tests (`tests/v2-multidomain-api.test.ts` + new availability cases):**
  - Test `checkSubdomainAvailability` for `invalid`, `protected` (`@`, `www`, `mail`), `reserved` (public vs admin `canOverride`), `taken` (Git registry, Name.com live API, Namecheap DoH), `available` (API & DoH), and `unverified` (DoH failure fallback).
  - Verify `invalidateDomainCache` clears the availability host-set cache too so newly created/deleted records reflect immediately.
- **i18n parity (`tests/i18n.test.ts`):** 100% key and ICU variable parity between `site/messages/vi.json` and `site/messages/en.json`.
- **Static checks:** `npm test`, `npm run typecheck`, `npm --prefix site run typecheck`, `npm run validate`, `npm run site:build`.
- **Live browser verification (Desktop `1440x900` + Mobile `390x844`, Light & Dark, VI & EN):**
  - Verify Home `/` shows only 1 centered form on the ambient background with zero vertical overflow on desktop.
  - Verify pressing `Tiếp tục` checks availability: taken/reserved/invalid show inline feedback without popup; available opens `SubdomainSetupDialog`.
  - Verify Admin unlock handoff from inside popup, Namecheap 2-step manual flow, `Tùy chọn nâng cao` toggle, `/directory` clean list without empty Repo noise, and `/health` hosting quota & env checks.
  - Verify `0` console/hydration errors and `0px` layout shift.

## 6. Decisions Made by Designer (For User Review)

1. **Sidebar trimmed from 4 items to 3 (`Trang chủ`, `Danh sách`, `Hệ thống`):** Removes the duplicate `Tạo Subdomain` item since Home `/` is now the primary subdomain creation flow; `/claim` stays accessible as an advanced route from `Hệ thống` and the popup's Advanced drawer.
2. **Quota `0/180` card removed from Sidebar:** Moved exclusively to `Hệ thống` (`/health`) so non-coders aren't confused by `0/180` on every screen.
3. **Default theme stays Warm Light Mode (with full Dark Mode toggle):** Preserves the existing light/dark toggle and OS preference; can switch to Dark-first if preferred.
4. **Domain selector implemented as a flush dropdown inside the Home input bar:** Scales cleanly if you add more root domains in the future (3, 5, 10+) without crowding the screen.
5. **Non-web technical records (`TXT`, `MX`, `NS`, `@`) hidden behind an Admin toggle on `/directory`:** Keeps `/directory` spotless with shareable web links (`Sao chép link` copies `https://<fqdn>`) by default, while Admins can toggle `Hiện bản ghi kỹ thuật` anytime to inspect/copy values or delete TXT records.
6. **Security & graceful fallback on availability check:** Public visitors short-circuit on reserved labels before live queries (no host enumeration leak), provider API errors gracefully fall back to DoH (or return `502` if both fail), and unconfigured API domains (`auto-needs-env`) smoothly degrade to the 2-step registrar-agnostic Copy Guide inside the popup.
