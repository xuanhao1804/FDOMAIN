import { CopyButton } from "@/components/copy-button";
import { RegistryExplorer } from "@/components/registry-explorer";
import { loadSiteRegistryData } from "@/lib/registry";

export default function HomePage() {
  const data = loadSiteRegistryData();
  const repoUrl = `https://github.com/${data.repository}`;
  const newFileUrl = `${repoUrl}/new/main/domains`;

  const liveCount = data.entries.filter((e) => e.health.status === "live").length;
  const warnCount = data.entries.filter((e) => e.health.status === "warn").length;
  const deadCount = data.entries.filter((e) => e.health.status === "dead").length;
  const quotaPercent = Math.min(
    100,
    Math.round((data.totalDnsRecords / data.limits.maxTotalRecords) * 100),
  );

  const sampleJson = `{
  "owner": { "github": "your-github-username" },
  "description": "My project deployed on Vercel",
  "records": {
    "CNAME": "cname.vercel-dns.com"
  }
}`;

  return (
    <>
      <a href="#registry-main" className="skip-link">
        Skip to content
      </a>

      <header
        className="border-b"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--bg-surface)",
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="font-mono-code text-sm font-semibold tracking-tight">
              FDOMAIN
            </span>
            <span
              className="font-mono-code rounded-full px-2.5 py-0.5 text-xs"
              style={{
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-color)",
                color: "var(--text-muted)",
              }}
            >
              *.{data.rootDomain}
            </span>
          </div>

          <nav aria-label="Primary" className="flex items-center gap-4 text-sm">
            <a
              href="#claim-guide"
              className="hover:underline underline-offset-4"
              style={{ color: "var(--text-muted)" }}
            >
              Claim guide
            </a>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:underline underline-offset-4"
              style={{ color: "var(--text-muted)" }}
            >
              GitHub
            </a>
            <a
              href={newFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="editorial-btn"
            >
              Request subdomain
            </a>
          </nav>
        </div>
      </header>

      <main
        id="registry-main"
        tabIndex={-1}
        className="mx-auto max-w-5xl space-y-16 px-5 py-14 sm:py-20"
      >
        <section className="reveal-block space-y-5">
          <p
            className="font-mono-code text-xs uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Personal DNS-as-Code Registry
          </p>
          <h1 className="font-editorial max-w-3xl text-4xl font-normal sm:text-5xl">
            Subdomains under <span className="font-mono-code text-[0.82em]">{data.rootDomain}</span>,
            versioned in Git.
          </h1>
          <p className="max-w-2xl text-base" style={{ color: "var(--text-muted)" }}>
            Each subdomain lives in a single JSON file. Merged pull requests sync
            DNS-only records to Cloudflare via DNSControl, while a daily scan flags
            dangling host targets before takeover can happen.
          </p>
        </section>

        <section aria-label="Registry summary" className="reveal-block grid gap-4 sm:grid-cols-3">
          <div className="editorial-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Active Entries
            </p>
            <p className="font-editorial mt-2 text-3xl font-medium">{data.entries.length}</p>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              {liveCount} live · {warnCount} warn · {deadCount} dead
            </p>
          </div>

          <div className="editorial-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Cloudflare Record Quota
            </p>
            <p className="font-editorial mt-2 text-3xl font-medium">
              {data.totalDnsRecords}
              <span className="text-base font-normal" style={{ color: "var(--text-muted)" }}>
                {" "}
                / {data.limits.maxTotalRecords}
              </span>
            </p>
            <div
              className="mt-3 h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "var(--bg-subtle)" }}
            >
              <div
                className="h-full"
                style={{
                  width: `${quotaPercent}%`,
                  backgroundColor: "var(--text-primary)",
                }}
              />
            </div>
          </div>

          <div className="editorial-card p-6">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              Last Health Scan
            </p>
            <p className="font-mono-code mt-2 text-sm font-medium">
              {data.statusCheckedAt
                ? new Date(data.statusCheckedAt).toISOString().replace("T", " ").slice(0, 16) + " UTC"
                : "Pending first daily scan"}
            </p>
            <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
              Alerts open on GitHub Issues under dead-subdomain.
            </p>
          </div>
        </section>

        <div className="reveal-block">
          <RegistryExplorer entries={data.entries} rootDomain={data.rootDomain} />
        </div>

        <section
          id="claim-guide"
          aria-labelledby="guide-heading"
          className="reveal-block editorial-card space-y-6 p-6 sm:p-8"
        >
          <div className="space-y-2">
            <h2 id="guide-heading" className="font-editorial text-2xl font-medium">
              How to claim or update a subdomain
            </h2>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Trusted contributors get automated merges when editing only their own
              files; new contributors receive a quick admin review.
            </p>
          </div>

          <ol role="list" className="grid gap-4 sm:grid-cols-3">
            <li
              className="rounded-lg p-4"
              style={{
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p className="font-mono-code text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                01 · DEPLOY FIRST
              </p>
              <p className="mt-1.5 text-sm">
                Host your app on Vercel, Netlify, GitHub Pages, or a VPS and copy its
                CNAME target or IP address.
              </p>
            </li>
            <li
              className="rounded-lg p-4"
              style={{
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p className="font-mono-code text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                02 · ADD JSON FILE
              </p>
              <p className="mt-1.5 text-sm">
                Open a PR adding <code className="font-mono-code">domains/yourname.json</code>{" "}
                with your GitHub username as <code className="font-mono-code">owner.github</code>.
              </p>
            </li>
            <li
              className="rounded-lg p-4"
              style={{
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-color)",
              }}
            >
              <p className="font-mono-code text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                03 · VERIFY IF ASKED
              </p>
              <p className="mt-1.5 text-sm">
                If Vercel asks for domain verification, add{" "}
                <code className="font-mono-code">vercelVerify</code>. Other hosts can
                use <code className="font-mono-code">extra</code>.
              </p>
            </li>
          </ol>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span
                className="font-mono-code text-xs"
                style={{ color: "var(--text-muted)" }}
              >
                domains/alice.json
              </span>
              <CopyButton value={sampleJson} label="Copy sample subdomain JSON" />
            </div>
            <pre
              className="font-mono-code overflow-x-auto rounded-lg p-4 text-xs leading-relaxed"
              style={{
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-color)",
              }}
            >
              <code>{sampleJson}</code>
            </pre>
          </div>
        </section>
      </main>

      <footer
        className="border-t py-8"
        style={{
          borderColor: "var(--border-color)",
          color: "var(--text-muted)",
        }}
      >
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 text-xs">
          <span>
            Managed via DNSControl + Cloudflare DNS-only · Repo{" "}
            <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {data.repository}
            </a>
          </span>
          <span>
            <a
              href={`${repoUrl}/issues?q=is%3Aissue+label%3Adead-subdomain`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Dead-subdomain alerts
            </a>
          </span>
        </div>
      </footer>
    </>
  );
}
