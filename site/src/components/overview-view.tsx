"use client";

import Link from "next/link";
import { getLocalizedDomainNote } from "@/lib/i18n/messages";
import type { SiteRegistryPayload } from "@/lib/registry";
import { useI18n } from "./i18n-context";
import { StatusBadge } from "./status-badge";

export function OverviewView({ data }: { data: SiteRegistryPayload }) {
  const { t } = useI18n();

  const liveCount = data.entries.filter((e) => e.health.status === "live").length;
  const warnCount = data.entries.filter((e) => e.health.status === "warn").length;
  const deadCount = data.entries.filter((e) => e.health.status === "dead").length;
  const previewEntries = data.entries.slice(0, 4);

  function providerBadgeLabel(provider: string): string {
    if (provider === "namecom") return t("domains.providerNamecomAuto");
    if (provider === "cloudflare-api") return t("domains.providerCloudflareAuto");
    if (provider === "cloudflare-gitops") return t("domains.providerCloudflareGitops");
    return t("domains.providerNamecheapManual");
  }

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
              {t("overview.heroBadge", {
                domains: data.rootDomains.map((d) => d.domain).join(" · "),
              })}
            </span>

            <h1 id="overview-hero-title" className="font-display text-3xl font-extrabold sm:text-4xl">
              {t("overview.heroTitle")}
            </h1>

            <p className="mx-auto max-w-xl text-sm sm:text-base md:mx-0" style={{ color: "var(--text-muted)" }}>
              {t("overview.heroSubtitle")}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-1 md:justify-start">
              <Link href="/claim" className="chibi-cta">
                {t("overview.heroClaimCta")}
              </Link>
              <Link href="/directory" className="chibi-secondary-btn">
                {t("overview.heroBrowseCta", { count: data.entries.length })}
              </Link>
            </div>
          </div>

          <div className="shrink-0">
            <img
              src="/images/chibi-courier.png"
              alt={t("overview.heroMascotAlt")}
              width={160}
              height={265}
              className="h-44 w-auto select-none sm:h-52"
            />
          </div>
        </div>
      </section>

      {/* Available Root Domains Showcase */}
      <section aria-labelledby="available-domains-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="available-domains-heading" className="font-display text-lg font-extrabold">
            {t("overview.availableHeading", { count: data.rootDomains.length })}
          </h2>
          <Link href="/claim" className="text-xs font-bold underline underline-offset-4">
            {t("overview.openBuilderLink")}
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {data.rootDomains.map((dom) => {
            const isAuto = dom.dnsProvider !== "namecheap-manual";
            return (
              <div
                key={dom.domain}
                className="chibi-row-card flex flex-col justify-between gap-4 p-5"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-code text-lg font-extrabold">
                      *.{dom.domain}
                    </span>
                    <span
                      className="rounded-full border px-2.5 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: isAuto ? "var(--badge-live-bg)" : "var(--badge-warn-bg)",
                        borderColor: isAuto ? "var(--badge-live-fg)" : "var(--badge-warn-fg)",
                        color: isAuto ? "var(--badge-live-fg)" : "var(--badge-warn-fg)",
                      }}
                    >
                      {providerBadgeLabel(dom.dnsProvider)}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    {getLocalizedDomainNote(t, dom.dnsProvider, dom.registrar, dom.note)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <Link
                    href={`/directory?domain=${encodeURIComponent(dom.domain)}`}
                    className="text-xs font-bold underline underline-offset-4"
                  >
                    {t("overview.inspectRecordsLink")}
                  </Link>
                  <Link
                    href={`/claim?domain=${encodeURIComponent(dom.domain)}`}
                    className="chibi-secondary-btn"
                  >
                    {t("overview.claimOnDomainCta", { domain: dom.domain })}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick Action Cards */}
      <section className="grid gap-4 md:grid-cols-3">
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
              {t("overview.cardLookupBadge")}
            </span>
            <h2 className="font-display text-lg font-extrabold">{t("overview.cardLookupTitle")}</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {t("overview.cardLookupDesc")}
            </p>
          </div>
          <span className="text-xs font-bold underline underline-offset-4">
            {t("overview.cardLookupCta")}
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
              {t("overview.cardStudioBadge")}
            </span>
            <h2 className="font-display text-lg font-extrabold">{t("overview.cardStudioTitle")}</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {t("overview.cardStudioDesc")}
            </p>
          </div>
          <span className="text-xs font-bold underline underline-offset-4">
            {t("overview.cardStudioCta")}
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
              {t("overview.cardMonitorBadge")}
            </span>
            <h2 className="font-display text-lg font-extrabold">{t("overview.cardMonitorTitle")}</h2>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
              {t("overview.cardMonitorDesc", {
                live: liveCount,
                warn: warnCount,
                dead: deadCount,
              })}
            </p>
          </div>
          <span className="text-xs font-bold underline underline-offset-4">
            {t("overview.cardMonitorCta")}
          </span>
        </Link>
      </section>

      {/* Compact Recent Subdomains Preview */}
      <section aria-labelledby="recent-heading" className="chibi-row-card space-y-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-heading" className="font-display text-lg font-extrabold">
            {t("overview.recentHeading")}
          </h2>
          <Link href="/directory" className="text-xs font-bold underline underline-offset-4">
            {t("overview.viewAllLink")}
          </Link>
        </div>

        {previewEntries.length === 0 ? (
          <div
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-4 py-4 text-xs sm:text-sm"
            style={{
              backgroundColor: "var(--bg-subtle)",
              borderColor: "var(--border-color)",
              color: "var(--text-muted)",
            }}
          >
            <span>{t("overview.emptyRegistryText")}</span>
            <Link href="/claim" className="chibi-secondary-btn shrink-0">
              {t("overview.emptyRegistryCta")}
            </Link>
          </div>
        ) : (
          <ul role="list" className="divide-y" style={{ borderColor: "var(--border-color)" }}>
            {previewEntries.map((entry) => (
              <li
                key={entry.fqdn}
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
        )}
      </section>
    </div>
  );
}
