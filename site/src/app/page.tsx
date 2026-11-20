import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";
import { loadSiteRegistryData } from "@/lib/registry";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export default function OverviewPage() {
  const data = loadSiteRegistryData();
  const liveCount = data.entries.filter((e) => e.health.status === "live").length;
  const warnCount = data.entries.filter((e) => e.health.status === "warn").length;
  const deadCount = data.entries.filter((e) => e.health.status === "dead").length;
  const previewEntries = data.entries.slice(0, 3);

  return (
    <div className="reveal-block space-y-6">
      {/* Hero Lobby Card */}
      <section
        aria-labelledby="overview-hero-title"
        className="chibi-panel relative overflow-hidden px-6 py-6 sm:px-8 sm:py-8"
      >
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex-1 space-y-4 text-center md:text-left">
            <span
              className="inline-block rounded-full border px-3 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: "var(--sky-soft)",
                borderColor: "#24324a",
                color: "#24324a",
              }}
            >
              DNS-as-Code Hub · *.{data.rootDomain}
            </span>

            <h1 id="overview-hero-title" className="font-display text-3xl font-extrabold sm:text-4xl">
              Personal Subdomain Station
            </h1>

            <p className="mx-auto max-w-xl text-sm sm:text-base md:mx-0" style={{ color: "var(--text-muted)" }}>
              Manage <span className="font-mono-code font-semibold">{data.rootDomain}</span>{" "}
              subdomains via GitHub Pull Requests, sync DNS-only records to Cloudflare, and catch
              dangling deployments before takeover.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 md:justify-start">
              <Link href="/claim" className="chibi-cta">
                + Claim Subdomain
              </Link>
              <Link href="/directory" className="chibi-secondary-btn">
                Browse Directory ({data.entries.length}) →
              </Link>
            </div>
          </div>

          <div className="shrink-0">
            <img
              src={`${BASE_PATH}/images/chibi-courier.png`}
              alt="Chibi domain courier waving beside a tiny cloud-pup mascot"
              width={160}
              height={265}
              className="h-44 w-auto select-none sm:h-52"
            />
          </div>
        </div>
      </section>

      {/* Feature Shortcuts */}
      <section aria-label="Registry sections" className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/directory"
          className="chibi-row-card flex flex-col justify-between gap-3 p-5 no-underline"
        >
          <div className="space-y-1.5">
            <span
              className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: "var(--sky-soft)",
                borderColor: "var(--border-color)",
                color: "#24324a",
              }}
            >
              Lookup
            </span>
            <h2 className="font-display text-lg font-extrabold">Subdomain Directory</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Search active subdomains, copy CNAME/IP targets, and open edit PRs.
            </p>
          </div>
          <span className="text-xs font-bold underline underline-offset-4">
            Open {data.entries.length} entries →
          </span>
        </Link>

        <Link
          href="/claim"
          className="chibi-row-card flex flex-col justify-between gap-3 p-5 no-underline"
        >
          <div className="space-y-1.5">
            <span
              className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: "var(--badge-warn-bg)",
                borderColor: "var(--badge-warn-fg)",
                color: "var(--badge-warn-fg)",
              }}
            >
              Builder
            </span>
            <h2 className="font-display text-lg font-extrabold">Claim JSON Generator</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              Pick Vercel, GitHub Pages, Netlify, or VPS and generate a PR-ready config.
            </p>
          </div>
          <span className="text-xs font-bold underline underline-offset-4">
            Create new subdomain →
          </span>
        </Link>

        <Link
          href="/health"
          className="chibi-row-card flex flex-col justify-between gap-3 p-5 no-underline"
        >
          <div className="space-y-1.5">
            <span
              className="inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold"
              style={{
                backgroundColor: "var(--badge-live-bg)",
                borderColor: "var(--badge-live-fg)",
                color: "var(--badge-live-fg)",
              }}
            >
              Monitor
            </span>
            <h2 className="font-display text-lg font-extrabold">Health &amp; Quota</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {liveCount} live · {warnCount} warn · {deadCount} dead ·{" "}
              {data.totalDnsRecords}/{data.limits.maxTotalRecords} records used.
            </p>
          </div>
          <span className="text-xs font-bold underline underline-offset-4">
            Inspect health scan →
          </span>
        </Link>
      </section>

      {/* Compact Recent Subdomains Preview */}
      <section aria-labelledby="recent-heading" className="chibi-row-card space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="font-display text-lg font-extrabold">
            Active Subdomains
          </h2>
          <Link href="/directory" className="text-xs font-bold underline underline-offset-4">
            View all →
          </Link>
        </div>

        <ul role="list" className="divide-y" style={{ borderColor: "var(--border-color)" }}>
          {previewEntries.map((entry) => (
            <li
              key={entry.label}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-1 last:pb-1"
              style={{ borderColor: "var(--shadow-tint)" }}
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
                  {entry.description}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
                  @{entry.owner.github}
                </span>
                <StatusBadge status={entry.health.status} reason={entry.health.reason} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
