# Contributing & Claiming a Subdomain

Want a subdomain under this registry? Every subdomain is defined by a single JSON file inside [`domains/`](../domains/).

---

## 1. Deploy your app first

Deploy your site on **Vercel**, **Netlify**, **GitHub Pages**, or a **VPS** so you know the target hostname (`CNAME`) or IP address (`A` / `AAAA`).

> **Note on Cloudflare Proxy:** All user records are **DNS-only** (unproxied). This keeps TLS/routing working on Vercel and lets the automated health check monitor dangling targets.

---

## 2. Create `domains/<your-label>.json`

Open a Pull Request adding `domains/<your-label>.json` (lowercase letters, digits, and hyphens only — no underscores in filenames).

### Basic CNAME example (Vercel / Netlify / GitHub Pages)

```json
{
  "owner": {
    "github": "your-github-username"
  },
  "description": "Short description of your project",
  "records": {
    "CNAME": "cname.vercel-dns.com"
  }
}
```

### VPS / A + AAAA + TXT example

`CNAME` cannot be combined with `A`, `AAAA`, or `TXT` on the same label. If you are not using `CNAME`, you may combine `A`, `AAAA`, and `TXT`:

```json
{
  "owner": {
    "github": "your-github-username"
  },
  "description": "Self-hosted API server",
  "records": {
    "A": ["203.0.113.10"],
    "AAAA": ["2001:db8::1"]
  }
}
```

---

## 3. Host Verification Records

### Vercel ("This domain is linked to another Vercel account")

If Vercel asks you to add a TXT record at `_vercel.<rootDomain>`, add the `vercelVerify` array to your JSON file (never create a `_vercel.json` file):

```json
{
  "owner": { "github": "your-github-username" },
  "description": "My portfolio on Vercel",
  "records": { "CNAME": "cname.vercel-dns.com" },
  "vercelVerify": [
    "vc-domain-verify=alice.harrylee.dev,REPLACE_WITH_YOUR_CODE"
  ]
}
```

The prefix must match `vc-domain-verify=<your-label>.<rootDomain>,`.

### GitHub Pages, Netlify, or Let's Encrypt DNS-01 (`extra`)

If your provider asks for an underscore verification record under your own subdomain (for example `_github-pages-challenge-alice.alice.harrylee.dev` or `_acme-challenge.alice.harrylee.dev`), use `extra`:

```json
{
  "owner": { "github": "alice-gh" },
  "description": "GitHub Pages site",
  "records": { "CNAME": "alice-gh.github.io" },
  "extra": {
    "_github-pages-challenge-alice-gh": {
      "TXT": ["your-challenge-token"]
    }
  }
}
```

---

## 4. Nested subdomains

You can register `api.blog.json` as long as `domains/blog.json` already exists and has the **same `owner.github`**.

---

## 5. Privacy note (`owner.contact`)

The optional `owner.contact` field is **hidden from the public web lookup portal**, but **this Git repository is public** — anything committed to `domains/*.json` is visible on GitHub. Omit `owner.contact` if you prefer not to publish an email or handle.
