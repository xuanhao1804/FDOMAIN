"use client";

import type { SiteRegistryPayload } from "@/lib/registry";
import { useAdminSession } from "./admin-context";
import { StatusBadge } from "./status-badge";

export function HealthView({ data }: { data: SiteRegistryPayload }) {
  const { authenticated, envStatus, capabilities, openLoginModal } = useAdminSession();

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
            Health, Quota &amp; API Status
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Monitor registry probes, quota limits, and Vercel provider API readiness across all configured root domains.
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
            Root Domains
          </p>
          <p className="font-display tabular-nums mt-2 text-3xl font-extrabold">
            {data.rootDomains.length}
          </p>
          <p className="font-mono-code mt-1 truncate text-xs" style={{ color: "var(--text-muted)" }}>
            {data.rootDomains.map((d) => d.domain).join(", ")}
          </p>
        </div>

        <div className="chibi-row-card p-5">
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
            Healthy (Live)
          </p>
          <p className="font-display tabular-nums mt-2 text-3xl font-extrabold">{liveCount}</p>
          <p className="mt-1 text-xs" style={{ color: "var(--badge-live-fg)" }}>
            HTTP 2xx / 3xx OK ({warnCount + pendingCount} warn/pending)
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
            Registry Record Quota
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

      {/* Vercel Server Env & Provider Readiness */}
      <div className="chibi-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-extrabold">Server Environment &amp; Providers</h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Boolean readiness checks only — API tokens stay strictly server-side in Vercel Env Vars.
            </p>
          </div>
          {!authenticated ? (
            <button type="button" onClick={openLoginModal} className="chibi-secondary-btn">
              Unlock Admin
            </button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              name: "ADMIN_PASSWORD",
              ready: envStatus.adminAuthConfigured,
              desc: "Required to unlock live DNS mutations",
            },
            {
              name: "NAMECOM_USERNAME + TOKEN",
              ready: envStatus.namecomConfigured,
              desc: "Auto create/list/delete for Name.com zones",
            },
            {
              name: "CLOUDFLARE_API_TOKEN",
              ready: envStatus.cloudflareConfigured,
              desc: "Optional auto sync for Cloudflare zones",
            },
          ].map((item) => (
            <div
              key={item.name}
              className="rounded-2xl border-2 p-4"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-color)",
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono-code text-xs font-bold">{item.name}</code>
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                  style={{
                    backgroundColor: item.ready
                      ? "var(--badge-live-bg)"
                      : "var(--badge-warn-bg)",
                    color: item.ready
                      ? "var(--badge-live-fg)"
                      : "var(--badge-warn-fg)",
                  }}
                >
                  {item.ready ? "Ready" : "Missing"}
                </span>
              </div>
              <p className="mt-1.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {capabilities.length > 0 ? (
          <ul role="list" className="grid gap-2.5 sm:grid-cols-2">
            {capabilities.map((cap) => (
              <li
                key={cap.domain}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              >
                <div>
                  <span className="font-mono-code text-sm font-bold">{cap.domain}</span>
                  <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>
                    ({cap.registrar})
                  </span>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor:
                      cap.mode === "auto-ready"
                        ? "var(--badge-live-bg)"
                        : "var(--badge-warn-bg)",
                    color:
                      cap.mode === "auto-ready"
                        ? "var(--badge-live-fg)"
                        : "var(--badge-warn-fg)",
                  }}
                >
                  {cap.mode === "auto-ready"
                    ? "Auto-DNS Ready"
                    : cap.mode === "auto-needs-env"
                      ? "Needs API Env"
                      : "Manual Copy + DoH"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {/* Per-Subdomain Probe Diagnostics */}
      <div className="chibi-panel space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">Git Registry Probe Diagnostics</h2>
          <span className="font-mono-code text-xs" style={{ color: "var(--text-muted)" }}>
            {data.statusCheckedAt
              ? `Last scan: ${new Date(data.statusCheckedAt).toISOString().replace("T", " ").slice(0, 16)} UTC`
              : "Awaiting first scheduled status.yml run"}
          </span>
        </div>

        {data.entries.length === 0 ? (
          <p
            className="rounded-2xl border-2 px-4 py-4 text-xs sm:text-sm"
            style={{
              backgroundColor: "var(--bg-surface)",
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            No Git-tracked JSON files in <code className="font-mono-code font-bold">domains/</code>{" "}
            yet — provider API readiness above reflects your live deployment state.
          </p>
        ) : (
          <ul role="list" className="space-y-2.5">
            {data.entries.map((entry) => (
              <li
                key={entry.fqdn}
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
                    {entry.health.reason}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                    @{entry.owner.github}
                  </span>
                  <StatusBadge status={entry.health.status} reason={entry.health.reason} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
