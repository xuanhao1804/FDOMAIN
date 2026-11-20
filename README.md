# FDOMAIN

Personal GitOps subdomain registry (`DNS-as-code`) backed by **GitHub + DNSControl + Cloudflare DNS**, paired with a static **Next.js + Tailwind CSS** lookup directory (`domains.<root>`) and daily dangling-subdomain health scanning.

## How it works

1. **One file per subdomain** in [`domains/`](domains/): `domains/blog.json` defines `blog.<rootDomain>`.
2. **Pull requests** run [`validate.yml`](.github/workflows/validate.yml) on `pull_request_target` using trusted code from `main` (never executing PR code):
   - Enforces file scope (`domains/*.json` only for non-admins), Zod schema, reserved names, case-insensitive ownership, nested parent ownership, and Cloudflare record quota.
   - Posts a live DNS record diff preview on the PR.
   - Auto-merges PRs from users listed in `config.json -> trusted` when they only touch their own non-reserved subdomain files.
3. **Admin fast path**: run `npm run sub -- add blog --cname cname.vercel-dns.com --push` to validate locally and push directly to `main`.
4. **Safe DNS sync** via [`deploy-dns.yml`](.github/workflows/deploy-dns.yml):
   - Compiles `domains/*.json` into `dist/dns-manifest.json` and runs `dnscontrol preview`.
   - Runs `scripts/drift-guard.ts` before `push` to verify DNSControl will not delete or modify any unmanaged/dashboard records (such as apex `@`, `www`, MX, or `_dmarc`).
5. **Daily health scan** via [`status.yml`](.github/workflows/status.yml) checks for NXDOMAIN CNAME targets and unclaimed Vercel / GitHub Pages / Netlify signatures (`dead-subdomain` issue alerts).
6. **Lookup portal** (`site/`): Next.js App Router (`output: 'export'`) + Tailwind CSS static web directory showing owners, copyable DNS records, health badges, and one-click GitHub edit links.

## Repository layout

```text
config.json                  # Root domain, admins, trusted[], reservedLabels, unmanaged[], limits
domains/                     # Subdomain JSON definitions
dnsconfig.js                 # DNSControl DSL reading compiled manifest
scripts/                     # Validation, PR diff, drift guard, health scan, admin CLI, site exporter
site/                        # Next.js (App Router, static export) + Tailwind CSS lookup site
tests/                       # Vitest unit tests
.github/workflows/           # validate, deploy-dns, status, deploy-site
docs/                        # Admin setup & contributor guides
```

## Quick commands

```bash
npm install
npm test                     # Run Vitest unit tests
npm run typecheck            # Typecheck scripts and tests
npm run validate             # Validate config.json + domains/*.json
npm run dns:build            # Build dist/dns-manifest.json for DNSControl
npm run sub -- list          # List registered subdomains
npm run site:build           # Export registry JSON and build static Next.js site (site/out/)
```

## Documentation

- [Admin Setup Guide (Cloudflare, Namecheap / name.com, GitHub Secrets)](docs/setup-guide.md)
- [Contributor Guide (Requesting a Subdomain & Vercel Verification)](docs/contributing.md)
- [Approved Design Specification](docs/superpowers/specs/2026-11-20-subdomain-registry-design.md)
