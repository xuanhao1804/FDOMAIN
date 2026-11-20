"use client";

import {
  ArrowRight,
  CloudCheck,
  CopySimple,
  GlobeHemisphereWest,
  Heartbeat,
  Plus,
  Stack,
  TerminalWindow,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { SiteRegistryPayload } from "@/lib/registry";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function OverviewView({ data }: { data: SiteRegistryPayload }) {
  const t = useTranslations("overview");
  const tDomains = useTranslations("domains");

  const liveCount = data.entries.filter((e) => e.health.status === "live").length;
  const warnCount = data.entries.filter((e) => e.health.status === "warn").length;
  const deadCount = data.entries.filter((e) => e.health.status === "dead").length;
  const autoApiCount = data.rootDomains.filter(
    (d) => d.dnsProvider !== "namecheap-manual",
  ).length;
  const previewEntries = data.entries.slice(0, 4);

  function providerBadgeLabel(provider: string): string {
    if (provider === "namecom") return tDomains("providerNamecomAuto");
    if (provider === "cloudflare-api") return tDomains("providerCloudflareAuto");
    if (provider === "cloudflare-gitops") return tDomains("providerCloudflareGitops");
    return tDomains("providerNamecheapManual");
  }

  function localizedDomainNote(
    dnsProvider: string,
    registrar: string,
    rawNote?: string,
  ): string {
    if (dnsProvider === "namecom" && (!rawNote || rawNote.includes("Name.com Core API"))) {
      return tDomains("noteNamecom");
    }
    if (
      dnsProvider === "namecheap-manual" &&
      (!rawNote || rawNote.includes("Namecheap BasicDNS"))
    ) {
      return tDomains("noteNamecheap");
    }
    return rawNote ?? tDomains("noteFallback", { registrar });
  }

  return (
    <div className="reveal-block space-y-8">
      {/* Asymmetrical Editorial Hero Bento */}
      <section aria-labelledby="overview-hero-title" className="editorial-hero-card">
        <div className="relative z-10 grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.75fr)] lg:items-center lg:gap-10">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2">
              <Badge variant="terracotta">
                <GlobeHemisphereWest size={12} weight="duotone" aria-hidden="true" />
                <span>{t("heroEyebrow")}</span>
              </Badge>
              <span className="font-mono-code hidden text-xs text-[var(--text-muted)] sm:inline">
                {data.rootDomains.map((d) => d.domain).join(" · ")}
              </span>
            </div>

            <h1
              id="overview-hero-title"
              className="font-editorial text-3xl font-semibold text-[var(--text-primary)] sm:text-4xl lg:text-[2.6rem]"
            >
              {t("heroTitle")}
            </h1>

            <p className="max-w-2xl text-sm leading-relaxed text-[var(--text-muted)] sm:text-[15px]">
              {t("heroSubtitle")}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <Button asChild size="lg">
                <Link href="/claim">
                  <Plus size={16} weight="bold" aria-hidden="true" />
                  <span>{t("heroClaimCta")}</span>
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/directory">
                  <span>{t("heroBrowseCta", { count: data.entries.length })}</span>
                  <ArrowRight size={15} weight="bold" aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Architectural Metric Stack */}
          <div className="divide-y divide-[var(--border-color)] rounded-xl border border-[var(--border-color)] bg-[var(--bg-paper)]">
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {t("statDomainsLabel")}
              </span>
              <span className="font-mono-code tabular-nums text-lg font-bold text-[var(--text-primary)]">
                {data.rootDomains.length}
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {t("statRecordsLabel")}
              </span>
              <span className="font-mono-code tabular-nums text-lg font-bold text-[var(--text-primary)]">
                {data.totalDnsRecords}
                <span className="text-xs font-normal text-[var(--text-muted)]">
                  /{data.limits.maxTotalRecords}
                </span>
              </span>
            </div>
            <div className="flex items-center justify-between px-4 py-3.5">
              <span className="text-xs font-medium text-[var(--text-muted)]">
                {t("statProvidersLabel")}
              </span>
              <span className="font-mono-code tabular-nums text-lg font-bold text-[var(--badge-live-fg)]">
                {autoApiCount}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Available Root Domains Bento */}
      <section aria-labelledby="available-domains-heading" className="space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="available-domains-heading"
            className="font-editorial text-xl font-semibold text-[var(--text-primary)]"
          >
            {t("availableHeading")}
          </h2>
          <Link
            href="/claim"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-4 transition-colors hover:text-[var(--text-primary)]"
          >
            <span>{t("openBuilderLink")}</span>
            <ArrowRight size={13} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {data.rootDomains.map((dom, idx) => {
            const isAuto = dom.dnsProvider !== "namecheap-manual";
            return (
              <Card
                key={dom.domain}
                interactive
                className="stagger-item flex flex-col justify-between gap-5 p-6"
                style={{ ["--stagger-index" as string]: idx }}
              >
                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
                        style={{
                          backgroundColor: isAuto
                            ? "var(--badge-live-bg)"
                            : "var(--badge-warn-bg)",
                          borderColor: isAuto
                            ? "var(--badge-live-border)"
                            : "var(--badge-warn-border)",
                          color: isAuto ? "var(--badge-live-fg)" : "var(--badge-warn-fg)",
                        }}
                      >
                        {isAuto ? (
                          <CloudCheck size={18} weight="duotone" aria-hidden="true" />
                        ) : (
                          <CopySimple size={18} weight="duotone" aria-hidden="true" />
                        )}
                      </span>
                      <span className="font-mono-code text-base font-bold text-[var(--text-primary)]">
                        *.{dom.domain}
                      </span>
                    </div>
                    <Badge variant={isAuto ? "live" : "warn"}>
                      {providerBadgeLabel(dom.dnsProvider)}
                    </Badge>
                  </div>

                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    {localizedDomainNote(dom.dnsProvider, dom.registrar, dom.note)}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-color)] pt-4">
                  <Link
                    href={`/directory?domain=${encodeURIComponent(dom.domain)}`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <span>{t("inspectRecordsLink")}</span>
                    <ArrowRight size={12} weight="bold" aria-hidden="true" />
                  </Link>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/claim?domain=${encodeURIComponent(dom.domain)}`}>
                      <span>{t("claimOnDomainCta", { domain: dom.domain })}</span>
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 3-Column Editorial Capability Grid */}
      <section className="grid gap-4 md:grid-cols-3">
        <Link href="/directory" className="group no-underline">
          <Card
            interactive
            className="stagger-item flex h-full flex-col justify-between gap-4 p-6"
            style={{ ["--stagger-index" as string]: 0 }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]">
                  <Stack size={18} weight="duotone" aria-hidden="true" />
                </span>
                <Badge variant="info">{t("cardLookupBadge")}</Badge>
              </div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {t("cardLookupTitle")}
              </h2>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                {t("cardLookupDesc")}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-terracotta)]">
              <span>{t("cardLookupCta")}</span>
              <ArrowRight size={13} weight="bold" aria-hidden="true" />
            </span>
          </Card>
        </Link>

        <Link href="/claim" className="group no-underline">
          <Card
            interactive
            className="stagger-item flex h-full flex-col justify-between gap-4 p-6"
            style={{ ["--stagger-index" as string]: 1 }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] text-[var(--badge-warn-fg)]">
                  <TerminalWindow size={18} weight="duotone" aria-hidden="true" />
                </span>
                <Badge variant="warn">{t("cardStudioBadge")}</Badge>
              </div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {t("cardStudioTitle")}
              </h2>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                {t("cardStudioDesc")}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-terracotta)]">
              <span>{t("cardStudioCta")}</span>
              <ArrowRight size={13} weight="bold" aria-hidden="true" />
            </span>
          </Card>
        </Link>

        <Link href="/health" className="group no-underline">
          <Card
            interactive
            className="stagger-item flex h-full flex-col justify-between gap-4 p-6"
            style={{ ["--stagger-index" as string]: 2 }}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--badge-live-border)] bg-[var(--badge-live-bg)] text-[var(--badge-live-fg)]">
                  <Heartbeat size={18} weight="duotone" aria-hidden="true" />
                </span>
                <Badge variant="live">{t("cardMonitorBadge")}</Badge>
              </div>
              <h2 className="text-base font-semibold text-[var(--text-primary)]">
                {t("cardMonitorTitle")}
              </h2>
              <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                {t("cardMonitorDesc", {
                  live: liveCount,
                  warn: warnCount,
                  dead: deadCount,
                })}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-terracotta)]">
              <span>{t("cardMonitorCta")}</span>
              <ArrowRight size={13} weight="bold" aria-hidden="true" />
            </span>
          </Card>
        </Link>
      </section>

      {/* Compact Registry Entries */}
      <Card className="p-6">
        <div className="flex items-center justify-between gap-3 pb-4">
          <h2 id="recent-heading" className="font-editorial text-xl font-semibold text-[var(--text-primary)]">
            {t("recentHeading")}
          </h2>
          <Link
            href="/directory"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <span>{t("viewAllLink")}</span>
            <ArrowRight size={12} weight="bold" aria-hidden="true" />
          </Link>
        </div>

        {previewEntries.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] px-4 py-4 text-xs sm:text-sm text-[var(--text-muted)]">
            <span>{t("emptyRegistryText")}</span>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/claim">
                <Plus size={14} weight="bold" aria-hidden="true" />
                <span>{t("emptyRegistryCta")}</span>
              </Link>
            </Button>
          </div>
        ) : (
          <ul role="list" className="divide-y divide-[var(--border-color)]">
            {previewEntries.map((entry) => (
              <li
                key={entry.fqdn}
                className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-1 last:pb-1"
              >
                <div className="min-w-0">
                  <a
                    href={`https://${entry.fqdn}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-code text-sm font-semibold text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--accent-terracotta)]"
                  >
                    {entry.fqdn}
                  </a>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{entry.description}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-code text-xs text-[var(--text-muted)]">
                    @{entry.owner.github}
                  </span>
                  <StatusBadge status={entry.health.status} reason={entry.health.reason} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
