# FDOMAIN — Project Map

## Purpose
Personal GitOps subdomain registry (`DNS-as-code`) managing subdomains on Cloudflare for one root domain (`harrylee.dev` placeholder in `config.json`), plus a static Next.js lookup site (`domains.<root>`) and automated dead-subdomain detection.

## Architecture
- `config.json`: Root domain, admin/trusted GitHub usernames, reserved labels, unmanaged dashboard records, record quota & deletion guard thresholds.
- `domains/*.json`: One JSON file per subdomain (or nested `sub.parent.json`).
- `dnsconfig.js`: DNSControl configuration reading `config.json` and `domains/*.json` to sync records to Cloudflare (`CLOUDFLAREAPI`). Ignores apex (`@`) and `unmanaged` dashboard entries.
- `scripts/`: TypeScript scripts (`tsx`) for:
  - `validate.ts`: Zod schema, filename/label rules, nested-parent existence & ownership, reserved labels, record limits, PR file-scope & ownership enforcement.
  - `diff-summary.ts`: PR diff preview comment generator (no Cloudflare secret needed).
  - `drift-guard.ts`: Ensures DNSControl preview deletions/modifications only affect managed labels and stay under the deletion threshold.
  - `status-check.ts`: Daily/manual DNS + HTTPS health scanner (`live`, `warn`, `dead` provider signatures) outputting `status.json`.
  - `sub.ts`: Admin CLI (`npm run sub -- add/remove/list`) for fast local management.
  - `export-site-data.ts`: Compiles `domains/*.json`, `config.json`, and `status.json` into static JSON consumed by `site/`.
- `site/`: Next.js (App Router, `output: 'export'`) + Tailwind CSS lookup portal.
- `.github/workflows/`: `validate.yml` (`pull_request_target` using base branch code), `deploy-dns.yml`, `status.yml`, `deploy-site.yml`.

## Milestones / Scope (v1)
- M1: Core config, schemas, `dnsconfig.js`, and repo scaffolding + tests.
- M2: PR validation, ownership check, diff summary, and admin CLI (`sub`).
- M3: Drift guard and GitHub Actions workflows (`validate`, `deploy-dns`, `status`, `deploy-site`) + `CODEOWNERS`.
- M4: Dead-subdomain scanner (`status-check`) and GitHub Issue alerting.
- M5: Next.js + Tailwind CSS static lookup site (`site/`).
- M6: User & admin documentation (`README.md`, `docs/`), full verification, and CodeGraph sync.
