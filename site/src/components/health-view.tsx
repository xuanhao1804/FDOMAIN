"use client";

import {
  ArrowUpRight,
  CheckCircle,
  Gauge,
  GlobeHemisphereWest,
  Heartbeat,
  LockSimpleOpen,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { SiteRegistryPayload } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useAdminSession } from "./admin-context";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function HealthView({ data }: { data: SiteRegistryPayload }) {
  const t = useTranslations("health");
  const { authenticated, envStatus, capabilities, openLoginModal, preloadLoginModal } =
    useAdminSession();

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
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{t("subtitle")}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={issuesUrl} target="_blank" rel="noopener noreferrer">
            <span>{t("viewAlertIssues")}</span>
            <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
          </a>
        </Button>
      </div>

      {/* 4-Column Metric Bento Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
              {t("rootDomainsCard")}
            </p>
            <GlobeHemisphereWest size={18} weight="duotone" aria-hidden="true" className="text-[var(--badge-info-fg)]" />
          </div>
          <p className="font-mono-code tabular-nums mt-3 text-3xl font-bold text-[var(--text-primary)]">
            {data.rootDomains.length}
          </p>
          <p className="font-mono-code mt-1.5 truncate text-xs text-[var(--text-muted)]">
            {data.rootDomains.map((d) => d.domain).join(", ")}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
              {t("healthyLiveCard")}
            </p>
            <Heartbeat size={18} weight="duotone" aria-hidden="true" className="text-[var(--badge-live-fg)]" />
          </div>
          <p className="font-mono-code tabular-nums mt-3 text-3xl font-bold text-[var(--text-primary)]">
            {liveCount}
          </p>
          <p className="mt-1.5 text-xs text-[var(--badge-live-fg)]">
            {t("healthySubtext", { other: warnCount + pendingCount })}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
              {t("deadRiskCard")}
            </p>
            <ShieldWarning size={18} weight="duotone" aria-hidden="true" className="text-[var(--badge-dead-fg)]" />
          </div>
          <p className="font-mono-code tabular-nums mt-3 text-3xl font-bold text-[var(--text-primary)]">
            {deadCount}
          </p>
          <p className="mt-1.5 text-xs text-[var(--badge-dead-fg)]">{t("deadSubtext")}</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
              {t("quotaCard")}
            </p>
            <Gauge size={18} weight="duotone" aria-hidden="true" className="text-[var(--accent-terracotta)]" />
          </div>
          <p className="font-mono-code tabular-nums mt-3 text-3xl font-bold text-[var(--text-primary)]">
            {data.totalDnsRecords}
            <span className="text-base font-normal text-[var(--text-muted)]">
              /{data.limits.maxTotalRecords}
            </span>
          </p>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--accent-terracotta)]"
              style={{ width: `${Math.max(quotaPct, data.totalDnsRecords > 0 ? 4 : 0)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Vercel Server Env & Provider Readiness (SSR-hydrated — zero post-load pop-in!) */}
      <Card className="isolated-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-editorial text-xl font-semibold text-[var(--text-primary)]">
              {t("serverEnvTitle")}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("serverEnvDesc")}</p>
          </div>
          {!authenticated ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onMouseEnter={preloadLoginModal}
              onFocus={preloadLoginModal}
              onClick={openLoginModal}
            >
              <LockSimpleOpen size={14} weight="bold" aria-hidden="true" />
              <span>{t("unlockAdmin")}</span>
            </Button>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              name: "ADMIN_PASSWORD",
              ready: envStatus.adminAuthConfigured,
              desc: t("envAdminDesc"),
            },
            {
              name: "NAMECOM_USERNAME + TOKEN",
              ready: envStatus.namecomConfigured,
              desc: t("envNamecomDesc"),
            },
            {
              name: "CLOUDFLARE_API_TOKEN",
              ready: envStatus.cloudflareConfigured,
              desc: t("envCloudflareDesc"),
            },
          ].map((item) => (
            <div
              key={item.name}
              className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono-code text-xs font-semibold text-[var(--text-primary)]">
                  {item.name}
                </code>
                <Badge variant={item.ready ? "live" : "warn"} className="min-w-[5.75rem] justify-center">
                  {item.ready ? (
                    <CheckCircle size={11} weight="fill" aria-hidden="true" />
                  ) : (
                    <WarningCircle size={11} weight="fill" aria-hidden="true" />
                  )}
                  <span>{item.ready ? t("readyBadge") : t("missingBadge")}</span>
                </Badge>
              </div>
              <p className="mt-2 text-xs text-[var(--text-muted)]">{item.desc}</p>
            </div>
          ))}
        </div>

        <ul role="list" className="grid gap-2.5 sm:grid-cols-2">
          {capabilities.map((cap) => (
            <li
              key={cap.domain}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] px-4 py-3"
            >
              <div>
                <span className="font-mono-code text-sm font-semibold text-[var(--text-primary)]">
                  {cap.domain}
                </span>
                <span className="ml-2 text-xs text-[var(--text-muted)]">({cap.registrar})</span>
              </div>
              <Badge
                variant={cap.mode === "auto-ready" ? "live" : "warn"}
                className="min-w-[9.25rem] justify-center"
              >
                {cap.mode === "auto-ready"
                  ? t("capAutoReady")
                  : cap.mode === "auto-needs-env"
                    ? t("capNeedsEnv")
                    : t("capManualCopy")}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>

      {/* Per-Subdomain Probe Diagnostics */}
      <Card className="isolated-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-editorial text-xl font-semibold text-[var(--text-primary)]">
            {t("probeTitle")}
          </h2>
          <span className="font-mono-code text-xs text-[var(--text-muted)]">
            {data.statusCheckedAt
              ? t("lastScan", {
                  timestamp: new Date(data.statusCheckedAt)
                    .toISOString()
                    .replace("T", " ")
                    .slice(0, 16),
                })
              : t("awaitingScan")}
          </span>
        </div>

        {data.entries.length === 0 ? (
          <p className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] px-4 py-4 text-xs sm:text-sm text-[var(--text-muted)]">
            {t("emptyProbeText")}
          </p>
        ) : (
          <ul role="list" className="divide-y divide-[var(--border-color)]">
            {data.entries.map((entry, idx) => (
              <li
                key={entry.fqdn}
                className={cn(
                  "flex flex-col gap-2 py-3.5 first:pt-1 last:pb-1 sm:flex-row sm:items-center sm:justify-between",
                  idx >= 8 && "deferred-record-row",
                )}
              >
                <div className="min-w-0">
                  <a
                    href={`https://${entry.fqdn}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-code text-sm font-semibold text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-4"
                  >
                    {entry.fqdn}
                  </a>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{entry.health.reason}</p>
                </div>
                <div className="flex items-center gap-3">
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
