import type { SiteRegistryPayload } from "@/lib/registry";
import { StatusBadge } from "./status-badge";

export function HealthView({ data }: { data: SiteRegistryPayload }) {
  const liveCount = data.entries.filter((e) => e.health.status === "live").length;
  const warnCount = data.entries.filter((e) => e.health.status === "warn").length;
  const deadCount = data.entries.filter((e) => e.health.status === "dead").length;
  const pendingCount = data.entries.filter((e) => e.health.status === "unknown").length;
  const quotaPct = Math.min(
    100,
    Math.round((data.totalDnsRecords / data.limits.maxTotalRecords) * 100),
  );
  const issuesUrl = `https://github.com/${data.repository}/issues?q=is%3Aissue+label%3Adead-subdomain`;

  return (
    <div className="reveal-block space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
            Health &amp; Quota Monitor
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Daily scan detects dangling CNAMEs and unclaimed Vercel / GitHub Pages / Netlify targets.
          </p>
        </div>
        <a
          href={issuesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="chibi-secondary-btn"
        >
          View Alert Issues ↗
        </a>
      </div>

      {/* Summary Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="chibi-row-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Healthy (Live)
          </p>
          <p className="font-display tabular-nums mt-2 text-3xl font-extrabold">{liveCount}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--badge-live-fg)" }}>
            HTTP 2xx / 3xx OK
          </p>
        </div>

        <div className="chibi-row-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Warnings / Pending
          </p>
          <p className="font-display tabular-nums mt-2 text-3xl font-extrabold">
            {warnCount + pendingCount}
          </p>
          <p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
            {warnCount} warn · {pendingCount} pending scan
          </p>
        </div>

        <div className="chibi-row-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Takeover Risk (Dead)
          </p>
          <p className="font-display tabular-nums mt-2 text-3xl font-extrabold">{deadCount}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--badge-dead-fg)" }}>
            Auto-alerts via Issue
          </p>
        </div>

        <div className="chibi-row-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Cloudflare Quota
          </p>
          <p className="font-display tabular-nums mt-2 text-3xl font-extrabold">
            {data.totalDnsRecords}
            <span className="text-base font-semibold" style={{ color: "var(--text-muted)" }}>
              /{data.limits.maxTotalRecords}
            </span>
          </p>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full border"
            style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border-color)" }}
          >
            <div
              className="h-full"
              style={{ width: `${quotaPct}%`, backgroundColor: "var(--mint)" }}
            />
          </div>
        </div>
      </div>

      {/* Per-Subdomain Probe Diagnostics */}
      <div className="chibi-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">Probe Diagnostics</h2>
          <span className="font-mono-code text-xs" style={{ color: "var(--text-muted)" }}>
            {data.statusCheckedAt
              ? `Last scan: ${new Date(data.statusCheckedAt).toISOString().replace("T", " ").slice(0, 16)} UTC`
              : "Awaiting first scheduled status.yml run"}
          </span>
        </div>

        <ul role="list" className="space-y-2.5">
          {data.entries.map((entry) => (
            <li
              key={entry.label}
              className="flex flex-col gap-2 rounded-2xl border-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-color)",
              }}
            >
              <div className="min-w-0">
                <a
                  href={`https://${entry.fqdn}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono-code text-sm font-bold underline underline-offset-4"
                >
                  {entry.fqdn}
                </a>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Owner @{entry.owner.github} · {entry.records.length} DNS record(s)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {entry.health.reason}
                </span>
                <StatusBadge status={entry.health.status} reason={entry.health.reason} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
