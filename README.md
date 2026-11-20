# FDOMAIN

Personal **Multi-Domain Subdomain Station** combining a fullstack **Next.js + Tailwind CSS** portal on Vercel (`site/`) with **instant Name.com / Cloudflare API DNS management**, **Namecheap copy-ready record generation + live DoH verification**, and optional **GitOps PR automation**.

## What it does

1. **Multi-Domain Studio (`/claim`)**: Pick from configured root domains (`harrylee.dev` on Name.com, `vinamuse.store` on Namecheap, or Cloudflare zones), type a subdomain with live `.<domain>` suffix switching, preview exact copyable `CNAME` / `A` / `TXT` records, verify propagation via DoH, or click **Create DNS Record Now** as Admin.
2. **Live Multi-Domain Directory (`/directory`)**: Filter across root domains, inspect Git-tracked entries and live provider records, verify live DoH, copy targets, or safely delete non-protected records as Admin.
3. **Health & API Monitor (`/health`)**: Track registry quotas, dangling-subdomain scans (`status.yml`), and boolean server readiness (`ADMIN_PASSWORD`, `NAMECOM_*`, `CLOUDFLARE_API_TOKEN`).
4. **GitOps PR Compatibility (`domains/` + `.github/workflows/`)**: Supports both `domains/<label>.json` (default domain) and `domains/<rootDomain>/<label>.json` via Pull Requests or `npm run sub -- add <label> --domain <rootDomain> ...`.

## Repository layout

```text
config.json                  # rootDomains[], admins, trusted[], reservedLabels, unmanaged[], limits
domains/                     # Subdomain JSON files (domains/<label>.json or domains/<domain>/<label>.json)
dnsconfig.js                 # DNSControl DSL for optional cloudflare-gitops zones
scripts/                     # Validation, PR diff, drift guard, health scan, admin CLI, site exporter
site/                        # Next.js App Router fullstack app (/api/* + bright anime-chibi UI)
tests/                       # Vitest unit tests
.github/workflows/           # validate, deploy-dns, status
docs/                        # Admin setup, contributor guide, architecture specs, repo context
```

## Quick commands

```bash
npm install
npm --prefix site install
npm test                     # Run Vitest unit tests
npm run typecheck            # Typecheck root scripts and tests
npm --prefix site run typecheck
npm run validate             # Validate config.json + multi-domain JSON entries
npm run dns:build            # Build dist/dns-manifest.json
npm run sub -- list          # List registered subdomains
npm run site:build           # Export registry JSON and build Next.js app (site/.next/)
```

## Documentation

- [Admin Setup Guide (Vercel Env Vars, Name.com, Namecheap, Cloudflare)](docs/setup-guide.md)
- [Contributor Guide (PR Subdomains & Vercel Verification)](docs/contributing.md)
- [v2 Multi-Domain Fullstack Spec](docs/superpowers/specs/2026-11-20-multi-domain-auto-dns-design.md)
- [v1 Core Registry Spec](docs/superpowers/specs/2026-11-20-subdomain-registry-design.md)
