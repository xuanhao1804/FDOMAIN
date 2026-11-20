# FDOMAIN — Project Map

## Purpose
Personal GitOps subdomain registry (`DNS-as-code`) managing subdomains on Cloudflare for one root domain (`harrylee.dev` placeholder in `config.json`), plus a static Next.js lookup site (`domains.<root>`) and automated dead-subdomain detection.

## Architecture
- `config.json`: Root domain, admin/trusted GitHub usernames, reserved labels, unmanaged dashboard records, record quota & deletion guard thresholds.
- `domains/*.json`: One JSON file per subdomain (or nested `sub.parent.json`).
- `dnsconfig.js`: DNSControl configuration reading `config.json` and `domains/*.json` to sync records to Cloudflare (`CLOUDFLAREAPI`). Ignores apex (`@`) and `unmanaged` dashboard entries.
- `scripts/`: TypeScript scripts (`tsx`) for:
  - `build-dns-manifest.ts`: Compiles `config.json` + `domains/*.json` into `dist/dns-manifest.json` for `dnsconfig.js`.
  - `validate.ts`: Zod schema, filename/label rules, nested-parent existence & ownership, reserved labels, record limits, PR file-scope & ownership enforcement, and `--emit-manifest`.
  - `diff-summary.ts`: PR diff preview comment generator (no Cloudflare secret needed).
  - `drift-guard.ts`: Ensures DNSControl preview deletions/modifications only affect managed labels and stay under the deletion threshold.
  - `status-check.ts`: Daily/manual DNS + HTTPS health scanner (`live`, `warn`, `dead` provider signatures) outputting `status.json` and managing `dead-subdomain` Issues.
  - `sub.ts`: Admin CLI (`npm run sub -- add/remove/list`) for fast local management.
  - `export-site-data.ts`: Compiles `domains/*.json`, `config.json`, and `status.json` into static JSON consumed by `site/` (omitting `owner.contact`).
- `site/`: Next.js (App Router, `output: 'export'`) + Tailwind CSS v4 lookup portal.
- `.github/workflows/`: `validate.yml` (`pull_request_target` using base branch code), `deploy-dns.yml`, `status.yml`, `deploy-site.yml`.
- `vercel.json`: Optional root-level Vercel build configuration (`npm run site:build` -> `site/out`).

## Milestones / Scope (v1)
- M1: Core config, schemas, `dnsconfig.js`, and repo scaffolding + tests (`23b3167`).
- M2: PR validation, ownership check, diff summary, and admin CLI (`a993559`).
- M3: Drift guard and GitHub Actions workflows (`validate`, `deploy-dns`, `status`, `deploy-site`) + `CODEOWNERS` (`240475c`).
- M4: Dead-subdomain scanner (`status-check`) and GitHub Issue alerting (`8d5f395`).
- M5: Next.js + Tailwind CSS static lookup site (`site/`) and `export-site-data.ts`.
- M6: User & admin documentation (`README.md`, `docs/setup-guide.md`, `docs/contributing.md`), browser verification, full test/build verification, and CodeGraph sync.
