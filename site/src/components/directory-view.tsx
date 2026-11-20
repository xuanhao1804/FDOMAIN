"use client";

import {
  ArrowsClockwise,
  Broadcast,
  LockSimpleOpen,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShieldCheck,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { LiveDnsRecord } from "@/lib/dns-providers/types";
import {
  getCachedLiveRecords,
  invalidateLiveRecordsCache,
  setCachedLiveRecords,
} from "@/lib/live-records-cache";
import type { SiteRootDomainMeta, SiteSubdomainItem, SubdomainHealth } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useAdminSession } from "./admin-context";
import { CopyButton } from "./copy-button";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

const importDeleteDialog = () =>
  import("./delete-record-dialog").then((mod) => mod.DeleteRecordDialog);

const LazyDeleteRecordDialog = dynamic(importDeleteDialog, {
  ssr: false,
});

const LIVE_PAGE_SIZE = 20;

interface DirectoryViewProps {
  entries: SiteSubdomainItem[];
  rootDomains: SiteRootDomainMeta[];
  initialDomainFilter: string;
}

type StatusFilter = "all" | SubdomainHealth;

export function DirectoryView({
  entries,
  rootDomains,
  initialDomainFilter,
}: DirectoryViewProps) {
  const t = useTranslations("directory");
  const tStatus = useTranslations("status");
  const tCommon = useTranslations("common");
  const { authenticated, openLoginModal, preloadLoginModal } = useAdminSession();

  const [domainFilter, setDomainFilter] = useState<string>(initialDomainFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [liveRecords, setLiveRecords] = useState<LiveDnsRecord[]>(
    () => getCachedLiveRecords(authenticated) ?? [],
  );
  const [liveLoading, setLiveLoading] = useState(() => getCachedLiveRecords(authenticated) === null);
  const [hasLoadedLiveOnce, setHasLoadedLiveOnce] = useState(
    () => getCachedLiveRecords(authenticated) !== null,
  );
  const [liveError, setLiveError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [dohResults, setDohResults] = useState<Record<string, string>>({});
  const [visibleLiveCount, setVisibleLiveCount] = useState(LIVE_PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Lazy delete confirmation modal state
  const [deleteDialogMounted, setDeleteDialogMounted] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<LiveDnsRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const preloadDeleteDialog = useCallback(() => {
    void importDeleteDialog();
  }, []);

  const loadLiveRecords = useCallback(
    async (options?: { force?: boolean; signal?: AbortSignal }) => {
      if (!options?.force) {
        const cached = getCachedLiveRecords(authenticated);
        if (cached) {
          setLiveRecords(cached);
          setLiveLoading(false);
          setHasLoadedLiveOnce(true);
          return;
        }
      }

      setLiveLoading(true);
      setLiveError(null);
      try {
        const res = await fetch("/api/dns/records", {
          cache: "no-store",
          signal: options?.signal,
        });
        if (!res.ok) {
          const errBody = (await res.json()) as { error?: string };
          setLiveError(errBody.error ?? t("liveLoadError"));
          return;
        }
        const body = (await res.json()) as { records?: LiveDnsRecord[] };
        const records = body.records ?? [];
        setCachedLiveRecords(authenticated, records);
        setLiveRecords(records);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        // Offline / fallback mode
      } finally {
        if (!options?.signal?.aborted) {
          setLiveLoading(false);
          setHasLoadedLiveOnce(true);
        }
      }
    },
    [authenticated, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadLiveRecords({ signal: controller.signal });
    return () => controller.abort();
  }, [loadLiveRecords]);

  // Reset progressive slice when filter changes
  useEffect(() => {
    setVisibleLiveCount(LIVE_PAGE_SIZE);
  }, [domainFilter, deferredQuery]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function checkLiveDoh(fqdn: string, type: string) {
    const queryType = ["CNAME", "A", "AAAA", "TXT"].includes(type.toUpperCase())
      ? type.toUpperCase()
      : "CNAME";
    setDohResults((prev) => ({ ...prev, [fqdn]: t("dohChecking") }));
    try {
      const res = await fetch(
        `/api/dns/lookup?fqdn=${encodeURIComponent(fqdn)}&type=${encodeURIComponent(queryType)}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        status?: string;
        answers?: Array<{ data: string }>;
        error?: string;
      };
      if (!res.ok) {
        setDohResults((prev) => ({ ...prev, [fqdn]: body.error ?? t("dohErrorFallback") }));
        return;
      }
      const text =
        body.answers && body.answers.length > 0
          ? t("dohResultFound", {
              type: queryType,
              answers: body.answers.map((a) => a.data).join(", "),
            })
          : t("dohResultEmpty", { status: body.status ?? "empty" });
      setDohResults((prev) => ({ ...prev, [fqdn]: text }));
    } catch {
      setDohResults((prev) => ({ ...prev, [fqdn]: t("dohLookupFailed") }));
    }
  }

  function requestDeleteRecord(rec: LiveDnsRecord) {
    setDeleteDialogMounted(true);
    setPendingDelete(rec);
  }

  async function executeConfirmedDelete(allowReserved: boolean) {
    if (!pendingDelete || !pendingDelete.id) return;
    setDeleting(true);
    setActionBanner(null);
    try {
      const res = await fetch("/api/dns/records", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootDomain: pendingDelete.domain,
          recordId: pendingDelete.id,
          allowReserved,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setActionBanner(body.error ?? t("deleteErrorFallback"));
      } else {
        invalidateLiveRecordsCache();
        setActionBanner(
          t("deletedBanner", {
            fqdn: pendingDelete.fqdn,
            type: pendingDelete.type,
          }),
        );
        await loadLiveRecords({ force: true });
      }
    } catch {
      setActionBanner(t("deleteNetworkError"));
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  const filteredGitEntries = entries.filter((item) => {
    if (
      domainFilter !== "all" &&
      item.rootDomain.toLowerCase() !== domainFilter.toLowerCase()
    ) {
      return false;
    }
    if (statusFilter !== "all" && item.health.status !== statusFilter) {
      return false;
    }
    if (!deferredQuery) return true;
    return (
      item.fqdn.toLowerCase().includes(deferredQuery) ||
      item.owner.github.toLowerCase().includes(deferredQuery) ||
      item.description.toLowerCase().includes(deferredQuery) ||
      item.records.some(
        (r) =>
          r.value.toLowerCase().includes(deferredQuery) ||
          r.type.toLowerCase().includes(deferredQuery),
      )
    );
  });

  const filteredLiveRecords = liveRecords.filter((rec) => {
    if (domainFilter !== "all" && rec.domain.toLowerCase() !== domainFilter.toLowerCase()) {
      return false;
    }
    if (!deferredQuery) return true;
    return (
      rec.fqdn.toLowerCase().includes(deferredQuery) ||
      rec.host.toLowerCase().includes(deferredQuery) ||
      rec.type.toLowerCase().includes(deferredQuery) ||
      rec.value.toLowerCase().includes(deferredQuery)
    );
  });

  const displayedLiveRecords = filteredLiveRecords.slice(0, visibleLiveCount);
  const remainingLiveCount = Math.max(0, filteredLiveRecords.length - displayedLiveRecords.length);

  // Auto-load next batch lazily when scrolling near bottom sentinel
  useEffect(() => {
    if (remainingLiveCount === 0) return;
    const node = loadMoreRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (observerEntries) => {
        if (observerEntries.some((entry) => entry.isIntersecting)) {
          setVisibleLiveCount((prev) => prev + LIVE_PAGE_SIZE);
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [remainingLiveCount]);

  const statusButtons: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: tStatus("all") },
    { id: "live", label: tStatus("live") },
    { id: "warn", label: tStatus("warn") },
    { id: "dead", label: tStatus("dead") },
    { id: "unknown", label: tStatus("unknown") },
  ];

  const hasActiveFilters =
    Boolean(deferredQuery) || domainFilter !== "all" || statusFilter !== "all";

  const activeClaimHref =
    domainFilter !== "all"
      ? `/claim?domain=${encodeURIComponent(domainFilter)}`
      : "/claim";

  return (
    <div className="reveal-block space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="font-editorial text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
            {t("title")}
          </h1>
          <p className="text-sm text-[var(--text-muted)]">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              <span>{t("unlockAdminView")}</span>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <Link href={activeClaimHref}>
              <Plus size={14} weight="bold" aria-hidden="true" />
              <span>{t("newSubdomain")}</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Bar Card */}
      <Card className="isolated-card space-y-4 p-4 sm:p-5">
        <div
          role="group"
          aria-label={t("filterDomainAria")}
          className="flex flex-wrap items-center gap-1.5"
        >
          <button
            type="button"
            aria-pressed={domainFilter === "all"}
            onClick={() => setDomainFilter("all")}
            className={cn(
              "min-h-8 cursor-pointer rounded-md border px-3 text-xs font-semibold transition-colors",
              domainFilter === "all"
                ? "border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]"
                : "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
            )}
          >
            {t("allDomains", { count: rootDomains.length })}
          </button>
          {rootDomains.map((dom) => {
            const active = domainFilter.toLowerCase() === dom.domain.toLowerCase();
            return (
              <button
                key={dom.domain}
                type="button"
                aria-pressed={active}
                onClick={() => setDomainFilter(dom.domain)}
                className={cn(
                  "font-mono-code min-h-8 cursor-pointer rounded-md border px-3 text-xs font-semibold transition-colors",
                  active
                    ? "border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]"
                    : "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]",
                )}
              >
                *.{dom.domain}
              </button>
            );
          })}
        </div>

        <search>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative flex-1">
              <label htmlFor="subdomain-search" className="sr-only">
                {t("searchLabel")}
              </label>
              <MagnifyingGlass
                size={16}
                weight="bold"
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-[var(--text-muted)]"
              />
              <input
                ref={searchInputRef}
                id="subdomain-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  domainFilter === "all"
                    ? t("searchPlaceholderAll")
                    : t("searchPlaceholderDomain", { domain: domainFilter })
                }
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="min-h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] py-2 pr-10 pl-10 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors focus-visible:border-[var(--focus-ring)] sm:text-sm"
              />
              <kbd aria-hidden="true" className="kbd-key pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">
                /
              </kbd>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                className="flex flex-wrap items-center gap-1"
                role="group"
                aria-label={t("filterStatusAria")}
              >
                {statusButtons.map((btn) => {
                  const active = statusFilter === btn.id;
                  return (
                    <button
                      key={btn.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setStatusFilter(btn.id)}
                      className={cn(
                        "min-h-8 cursor-pointer rounded-md border px-2.5 text-xs font-semibold transition-colors",
                        active
                          ? "border-[var(--border-strong)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                          : "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]",
                      )}
                    >
                      {btn.label}
                    </button>
                  );
                })}
              </div>

              <span
                aria-live="polite"
                className="font-mono-code tabular-nums min-w-[10.5rem] pl-1 text-right text-xs text-[var(--text-muted)]"
              >
                {t("summaryCount", {
                  registry: filteredGitEntries.length,
                  live: filteredLiveRecords.length,
                })}
              </span>
            </div>
          </div>
        </search>
      </Card>

      {/* Section 1: Live DNS Provider API Records (Primary — stable skeleton height, zero jump!) */}
      <section aria-labelledby="live-provider-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2
              id="live-provider-heading"
              className="font-editorial text-xl font-semibold text-[var(--text-primary)]"
            >
              {t("liveHeading")}
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              {authenticated ? t("liveDescUnlocked") : t("liveDescLocked")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void loadLiveRecords({ force: true })}
            disabled={liveLoading}
            className="min-w-[10.5rem]"
          >
            <ArrowsClockwise
              size={14}
              weight="bold"
              aria-hidden="true"
              className={cn(liveLoading && "animate-spin")}
            />
            <span>{liveLoading ? tCommon("refreshing") : t("refreshLiveDns")}</span>
          </Button>
        </div>

        {/* Fixed-height inline status strip (zero vertical jump when actionBanner/error changes) */}
        <div className="min-h-[1.5rem]">
          {actionBanner ? (
            <p
              role="status"
              className="truncate text-xs font-semibold text-[var(--badge-info-fg)]"
            >
              {actionBanner}
            </p>
          ) : liveError ? (
            <p
              role="alert"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--badge-warn-fg)]"
            >
              <WarningCircle size={14} weight="duotone" aria-hidden="true" className="shrink-0" />
              <span>{liveError}</span>
            </p>
          ) : null}
        </div>

        <div className="min-h-[19rem]">
          {!hasLoadedLiveOnce && liveLoading ? (
            <div aria-busy="true" aria-label={t("loadingLive")} className="space-y-2">
              {[0, 1, 2].map((idx) => (
                <Card
                  key={idx}
                  className="flex h-[6rem] items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-4 w-48 max-w-full" />
                    </div>
                    <Skeleton className="h-3.5 w-72 max-w-full" />
                  </div>
                  <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                    <Skeleton className="h-8 w-8 rounded-md" />
                    <Skeleton className="h-8 w-24 rounded-md" />
                  </div>
                </Card>
              ))}
            </div>
          ) : filteredLiveRecords.length === 0 ? (
            <Card className="flex min-h-[10rem] flex-col items-start justify-center gap-3 px-5 py-6 text-xs sm:text-sm text-[var(--text-muted)]">
              <p>{hasActiveFilters ? t("noMatchDesc") : t("emptyLiveRecords")}</p>
              {hasActiveFilters ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setQuery("");
                    setDomainFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  {t("showAllButton")}
                </Button>
              ) : null}
            </Card>
          ) : (
            <>
              <ul role="list" className="space-y-2">
                {displayedLiveRecords.map((rec, i) => (
                  <li
                    key={`${rec.domain}-${rec.id ?? rec.host}-${rec.type}-${i}`}
                    className={cn(
                      "bento-card bento-card-interactive flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between",
                      i >= 8 && "deferred-record-row",
                    )}
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="info" className="font-mono-code min-w-[3.75rem] justify-center">
                          {rec.type}
                        </Badge>
                        <span className="font-mono-code truncate text-sm font-semibold text-[var(--text-primary)]">
                          {rec.fqdn}
                        </span>
                        {rec.protected ? (
                          <Badge variant="neutral">
                            <ShieldCheck size={11} weight="fill" aria-hidden="true" />
                            <span>{t("protectedBadge")}</span>
                          </Badge>
                        ) : null}
                      </div>
                      <code className="font-mono-code block truncate text-xs text-[var(--text-muted)]">
                        {rec.value} · TTL {rec.ttl}s
                      </code>
                      <p className="font-mono-code min-h-[1.1rem] truncate text-xs font-medium text-[var(--badge-live-fg)]">
                        {dohResults[rec.fqdn] ?? ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      <CopyButton
                        value={rec.value}
                        label={t("copyValueAria", { type: rec.type, fqdn: rec.fqdn })}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => checkLiveDoh(rec.fqdn, rec.type)}
                        className="min-w-[6.75rem]"
                      >
                        <Broadcast size={14} weight="duotone" aria-hidden="true" />
                        <span>{t("checkDoh")}</span>
                      </Button>
                      {rec.canDelete ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onMouseEnter={preloadDeleteDialog}
                          onFocus={preloadDeleteDialog}
                          onClick={() => requestDeleteRecord(rec)}
                          className="min-w-[4.75rem]"
                        >
                          <Trash size={14} weight="duotone" aria-hidden="true" />
                          <span>{tCommon("delete")}</span>
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>

              {remainingLiveCount > 0 ? (
                <div ref={loadMoreRef} className="flex justify-center pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setVisibleLiveCount((prev) => prev + LIVE_PAGE_SIZE)}
                  >
                    {t("loadMoreLive", { remaining: remainingLiveCount })}
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>

      {/* Section 2: Git Registry Entries (Decoupled from liveRecords so height NEVER collapses 200px) */}
      <section aria-labelledby="git-registry-heading" className="space-y-3">
        <h2
          id="git-registry-heading"
          className="font-editorial text-xl font-semibold text-[var(--text-primary)]"
        >
          {t("trackedHeading")}
        </h2>

        {filteredGitEntries.length === 0 ? (
          <Card className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs sm:text-sm text-[var(--text-muted)]">
            <span>
              {entries.length === 0 ? t("noGitFilesLiveBelow") : t("noMatchDesc")}
            </span>
            {hasActiveFilters && entries.length > 0 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setDomainFilter("all");
                  setStatusFilter("all");
                }}
              >
                {t("showAllButton")}
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={activeClaimHref}>
                  <Plus size={14} weight="bold" aria-hidden="true" />
                  <span>{t("emptyClaimCta")}</span>
                </Link>
              </Button>
            )}
          </Card>
        ) : (
          <ul role="list" className="space-y-2.5">
            {filteredGitEntries.map((entry, idx) => {
              const firstType = entry.records[0]?.type ?? "CNAME";
              return (
                <li
                  key={entry.fqdn}
                  className={cn(
                    "bento-card bento-card-interactive flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between",
                    idx >= 8 && "deferred-record-row",
                  )}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={`https://${entry.fqdn}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono-code text-sm font-bold text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--accent-terracotta)]"
                      >
                        {entry.fqdn}
                      </a>
                      <StatusBadge status={entry.health.status} reason={entry.health.reason} />
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">{entry.description}</p>
                    <p className="font-mono-code min-h-[1.1rem] truncate text-xs font-medium text-[var(--badge-live-fg)]">
                      {dohResults[entry.fqdn] ?? ""}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <a
                      href={entry.owner.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--bg-paper)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--border-strong)]"
                    >
                      <img
                        src={entry.owner.avatarUrl}
                        alt=""
                        width={16}
                        height={16}
                        loading="lazy"
                        decoding="async"
                        className="rounded-full"
                      />
                      <span>@{entry.owner.github}</span>
                    </a>

                    <ul role="list" className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                      {entry.records.map((rec, recIdx) => {
                        const targetHost =
                          rec.label === entry.label
                            ? entry.fqdn
                            : `${rec.label}.${entry.rootDomain}`;
                        return (
                          <li
                            key={`${rec.label}-${rec.type}-${recIdx}`}
                            className="flex min-w-0 max-w-full items-center gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-paper)] px-2.5 py-1"
                          >
                            <Badge variant="info" className="font-mono-code shrink-0">
                              {rec.type}
                            </Badge>
                            {rec.label !== entry.label ? (
                              <span className="font-mono-code shrink-0 text-xs text-[var(--text-muted)]">
                                {rec.label}
                              </span>
                            ) : null}
                            <code className="font-mono-code truncate text-xs text-[var(--text-primary)]">
                              {rec.value}
                            </code>
                            <CopyButton
                              value={rec.value}
                              label={t("copyTargetAria", {
                                type: rec.type,
                                fqdn: targetHost,
                              })}
                            />
                          </li>
                        );
                      })}
                    </ul>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => checkLiveDoh(entry.fqdn, firstType)}
                      className="min-w-[6.75rem]"
                    >
                      <Broadcast size={14} weight="duotone" aria-hidden="true" />
                      <span>{t("checkDoh")}</span>
                    </Button>

                    <Button asChild variant="outline" size="sm">
                      <a
                        href={entry.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={t("editAriaLabel", { fqdn: entry.fqdn })}
                      >
                        <PencilSimple size={14} weight="duotone" aria-hidden="true" />
                        <span>{tCommon("edit")}</span>
                      </a>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Lazy-Loaded Native <dialog> Confirmation Modal */}
      {deleteDialogMounted ? (
        <LazyDeleteRecordDialog
          record={pendingDelete}
          deleting={deleting}
          onConfirm={executeConfirmedDelete}
          onClosed={() => setPendingDelete(null)}
        />
      ) : null}
    </div>
  );
}
