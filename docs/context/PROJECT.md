# FDOMAIN — Project Map

## Purpose
Personal Multi-Domain Subdomain Station: manages owned root domains (`harrylee.dev` on Name.com Core API + `vinamuse.store` on Namecheap BasicDNS / optional Cloudflare) via a fullstack Next.js App Router portal on Vercel (`site/`) plus optional GitOps PR automation (`domains/` + `.github/workflows/`).

## Architecture
- `config.json`: Configured `rootDomains[]` (`harrylee.dev` `namecom`, `vinamuse.store` `namecheap-manual`), admin/trusted GitHub usernames, reserved labels, unmanaged dashboard records, record quota & deletion guard thresholds.
- `domains/`: One JSON file per GitOps subdomain (`domains/<label>.json` for primary domain or `domains/<rootDomain>/<label>.json` for scoped multi-domain).
- `dnsconfig.js`: DNSControl configuration reading `dist/dns-manifest.json` only for zones marked `dnsProvider: "cloudflare-gitops"`.
- `scripts/`: TypeScript scripts (`tsx`) for manifest build, Zod multi-domain PR validation, PR diff summary, drift guard, daily health scanner (`status-check`), admin CLI (`npm run sub -- add/remove/list --domain`), and `export-site-data.ts`.
- `site/`: Fullstack Next.js 15 App Router + Tailwind CSS v4 bright anime-chibi portal (`/`, `/directory/`, `/claim/`, `/health/`), multi-language JSON catalogs (`site/src/locales/{vi,en}.json`, default `vi` with `fdomain_locale` SSR cookie), API routes (`/api/auth/*`, `/api/domains`, `/api/dns/records`, `/api/dns/lookup`, `/api/health`), and `@vercel/functions` metrics.
- `site/vercel.json` & root `vercel.json`: Vercel deployment config (`Root Directory = site`, Framework `Next.js`).
- `.github/workflows/`: `validate.yml` (`pull_request_target`), scoped `deploy-dns.yml`, and `status.yml`.

## Milestones / Scope (v1)
- M1: Core config, schemas, `dnsconfig.js`, and repo scaffolding + tests (`23b3167`).
- M2: PR validation, ownership check, diff summary, and admin CLI (`a993559`).
- M3: Drift guard and GitHub Actions workflows (`validate`, `deploy-dns`, `status`, `deploy-site`) + `CODEOWNERS` (`240475c`).
- M4: Dead-subdomain scanner (`status-check`) and GitHub Issue alerting (`8d5f395`).
- M5: Next.js + Tailwind CSS static lookup site (`site/`) and `export-site-data.ts`.
- M6: User & admin documentation (`README.md`, `docs/setup-guide.md`, `docs/contributing.md`), browser verification, full test/build verification, and CodeGraph sync.
