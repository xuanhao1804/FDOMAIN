"use client";

import {
  ArrowsClockwise,
  Broadcast,
  FolderOpen,
  LockSimpleOpen,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShieldCheck,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { LiveDnsRecord } from "@/lib/dns-providers/types";
import type { SiteRootDomainMeta, SiteSubdomainItem, SubdomainHealth } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useAdminSession } from "./admin-context";
import { CopyButton } from "./copy-button";
import { StatusBadge } from "./status-badge";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

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
  const { authenticated, openLoginModal } = useAdminSession();

  const [domainFilter, setDomainFilter] = useState<string>(initialDomainFilter);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [liveRecords, setLiveRecords] = useState<LiveDnsRecord[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [actionBanner, setActionBanner] = useState<string | null>(null);
  const [dohResults, setDohResults] = useState<Record<string, string>>({});

  // Delete confirmation modal state
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [pendingDelete, setPendingDelete] = useState<LiveDnsRecord | null>(null);
  const [confirmReservedDelete, setConfirmReservedDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadLiveRecords = useCallback(async () => {
    setLiveLoading(true);
    setLiveError(null);
    try {
      const res = await fetch("/api/dns/records", { cache: "no-store" });
      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string };
        setLiveError(errBody.error ?? t("liveLoadError"));
        return;
      }
      const body = (await res.json()) as { records?: LiveDnsRecord[] };
      setLiveRecords(body.records ?? []);
    } catch {
      // Static or offline mode
    } finally {
      setLiveLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadLiveRecords();
  }, [loadLiveRecords, authenticated]);

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
    setPendingDelete(rec);
    setConfirmReservedDelete(false);
    const dialog = deleteDialogRef.current;
    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  async function executeConfirmedDelete() {
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
          allowReserved: confirmReservedDelete,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setActionBanner(body.error ?? t("deleteErrorFallback"));
      } else {
        setActionBanner(
          t("deletedBanner", {
            fqdn: pendingDelete.fqdn,
            type: pendingDelete.type,
          }),
        );
        await loadLiveRecords();
      }
    } catch {
      setActionBanner(t("deleteNetworkError"));
    } finally {
      setDeleting(false);
      if (deleteDialogRef.current?.open) {
        deleteDialogRef.current.close("confirm");
      }
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
            <Button type="button" variant="outline" size="sm" onClick={openLoginModal}>
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
      <Card className="space-y-4 p-4 sm:p-5">
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
                className="font-mono-code tabular-nums pl-1 text-xs text-[var(--text-muted)]"
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

      {actionBanner ? (
        <div
          role="status"
          className="rounded-lg border border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] px-4 py-3 text-xs font-medium text-[var(--badge-info-fg)]"
        >
          {actionBanner}
        </div>
      ) : null}

      {/* Section 1: Git Registry Entries */}
      <section aria-labelledby="git-registry-heading" className="space-y-3">
        <h2
          id="git-registry-heading"
          className="font-editorial text-xl font-semibold text-[var(--text-primary)]"
        >
          {t("trackedHeading")}
        </h2>

        {filteredGitEntries.length === 0 && filteredLiveRecords.length === 0 ? (
          <Card className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-[var(--border-color)] bg-[var(--bg-paper)] text-[var(--text-muted)]">
              <FolderOpen size={24} weight="duotone" aria-hidden="true" />
            </span>
            {hasActiveFilters ? (
              <>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {t("noMatchTitle")}
                  </p>
                  <p className="max-w-md text-xs text-[var(--text-muted)] sm:text-sm">
                    {t("noMatchDesc")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setDomainFilter("all");
                    setStatusFilter("all");
                  }}
                >
                  {t("showAllButton")}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <p className="text-base font-semibold text-[var(--text-primary)]">
                    {t("emptyTitle")}
                  </p>
                  <p className="max-w-md text-xs text-[var(--text-muted)] sm:text-sm">
                    {t("emptyDesc")}
                  </p>
                </div>
                <Button asChild>
                  <Link href={activeClaimHref}>
                    <Plus size={15} weight="bold" aria-hidden="true" />
                    <span>{t("emptyClaimCta")}</span>
                  </Link>
                </Button>
              </>
            )}
          </Card>
        ) : filteredGitEntries.length === 0 ? (
          <Card className="px-5 py-5 text-xs sm:text-sm text-[var(--text-muted)]">
            {t("noGitFilesLiveBelow")}
          </Card>
        ) : (
          <ul role="list" className="space-y-2.5">
            {filteredGitEntries.map((entry) => {
              const firstType = entry.records[0]?.type ?? "CNAME";
              return (
                <li
                  key={entry.fqdn}
                  className="bento-card bento-card-interactive flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
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
                        className="rounded-full"
                      />
                      <span>@{entry.owner.github}</span>
                    </a>

                    <ul role="list" className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                      {entry.records.map((rec, idx) => {
                        const targetHost =
                          rec.label === entry.label
                            ? entry.fqdn
                            : `${rec.label}.${entry.rootDomain}`;
                        return (
                          <li
                            key={`${rec.label}-${rec.type}-${idx}`}
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

      {/* Section 2: Live DNS Provider API Records */}
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
            onClick={() => void loadLiveRecords()}
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

        {liveError ? (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] px-4 py-3 text-xs font-medium text-[var(--badge-warn-fg)]">
            <WarningCircle size={15} weight="duotone" aria-hidden="true" className="shrink-0" />
            <span>{liveError}</span>
          </div>
        ) : filteredLiveRecords.length === 0 ? (
          <Card className="px-5 py-5 text-xs sm:text-sm text-[var(--text-muted)]">
            {t("emptyLiveRecords")}
          </Card>
        ) : (
          <ul role="list" className="space-y-2">
            {filteredLiveRecords.map((rec, i) => (
              <li
                key={`${rec.domain}-${rec.id ?? rec.host}-${rec.type}-${i}`}
                className="bento-card bento-card-interactive flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="info" className="font-mono-code">
                      {rec.type}
                    </Badge>
                    <span className="font-mono-code text-sm font-semibold text-[var(--text-primary)]">
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
                  >
                    <Broadcast size={14} weight="duotone" aria-hidden="true" />
                    <span>{t("checkDoh")}</span>
                  </Button>
                  {rec.canDelete ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => requestDeleteRecord(rec)}
                    >
                      <Trash size={14} weight="duotone" aria-hidden="true" />
                      <span>{tCommon("delete")}</span>
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Native <dialog> Confirmation Modal for Destructive DNS Delete */}
      <dialog
        ref={deleteDialogRef}
        id="confirm-delete-dialog"
        aria-labelledby="delete-dialog-title"
        className="editorial-modal"
        onClose={() => {
          if (deleteDialogRef.current) deleteDialogRef.current.returnValue = "";
          setPendingDelete(null);
          setConfirmReservedDelete(false);
        }}
      >
        <div className="flex items-center gap-2 border-b border-[var(--badge-dead-border)] bg-[var(--badge-dead-bg)] px-5 py-3.5">
          <Trash size={16} weight="duotone" aria-hidden="true" className="text-[var(--badge-dead-fg)]" />
          <h2 id="delete-dialog-title" className="text-sm font-semibold text-[var(--badge-dead-fg)]">
            {t("deleteDialogTitle")}
          </h2>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {pendingDelete ? (
            <p className="leading-relaxed text-[var(--text-secondary)]">
              {t("deleteDialogBody", {
                type: pendingDelete.type,
                fqdn: pendingDelete.fqdn,
                value: pendingDelete.value,
                domain: pendingDelete.domain,
              })}
            </p>
          ) : null}

          {pendingDelete?.reserved ? (
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] p-3 text-xs font-medium text-[var(--badge-warn-fg)]">
              <input
                type="checkbox"
                checked={confirmReservedDelete}
                onChange={(e) => setConfirmReservedDelete(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>{t("deleteReservedConfirm")}</span>
            </label>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              autoFocus
              onClick={() => deleteDialogRef.current?.close("cancel")}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructiveSolid"
              disabled={deleting || (Boolean(pendingDelete?.reserved) && !confirmReservedDelete)}
              onClick={() => void executeConfirmedDelete()}
            >
              {deleting ? tCommon("deleting") : t("confirmDeleteAction")}
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
