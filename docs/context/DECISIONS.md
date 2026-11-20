# Decisions

## 2026-11-20 — FDOMAIN v1 Architecture & Tech Choices
- **DNS-as-code via GitHub + DNSControl → Cloudflare**: Chosen over manual Cloudflare edits (no history/dead-scan) and a stateful backend dashboard (unnecessary cost/maintenance for solo + trusted friends).
- **Single-domain root first (`domains/*.json`)**: Matches 1-domain scope without premature folder nesting; extensible later.
- **Trusted auto-merge + Admin CLI**: Admin pushes straight to `main` via `npm run sub`; `trusted[]` contributors get auto-merge via `pull_request_target` when only editing their own non-reserved files and checks pass; others require manual approval.
- **Always DNS-only (`proxied` omitted from user schema)**: Prevents ToS/abuse proxying through admin Cloudflare account, avoids breaking Vercel, and keeps CNAME targets inspectable by dead-subdomain scanner.
- **Support `_xxx` verification records via `extra`**: Allows GitHub Pages challenges, ACME DNS-01, and Netlify verification under owner's subdomain, plus `vercelVerify` under `_vercel.<root>`.
- **Unmanaged dashboard safety**: Apex (`@`) and admin dashboard records remain outside the repo via `IGNORE` + `drift-guard.ts` checking `dnscontrol preview` against managed labels before push.
- **Lookup UI with Next.js (`output: 'export'`) + Tailwind CSS**: Static output hosts at $0 on GitHub Pages or Vercel while keeping React/Next.js familiarity for future dashboard/auth upgrades without NestJS in v1.
