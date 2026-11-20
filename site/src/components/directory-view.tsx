"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useRef, useState } from "react";
import type { LiveDnsRecord } from "@/lib/dns-providers/types";
import type { SiteRootDomainMeta, SiteSubdomainItem, SubdomainHealth } from "@/lib/registry";
import { useAdminSession } from "./admin-context";
import { CopyButton } from "./copy-button";
import { StatusBadge } from "./status-badge";

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
        setLiveError(errBody.error ?? "Unable to load live DNS records.");
        return;
      }
      const body = (await res.json()) as { records?: LiveDnsRecord[] };
      setLiveRecords(body.records ?? []);
    } catch {
      // Static or offline mode
    } finally {
      setLiveLoading(false);
    }
  }, []);

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
    setDohResults((prev) => ({ ...prev, [fqdn]: "Checking..." }));
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
        setDohResults((prev) => ({ ...prev, [fqdn]: body.error ?? "Error" }));
        return;
      }
      const text =
        body.answers && body.answers.length > 0
          ? `DoH ${queryType}: ${body.answers.map((a) => a.data).join(", ")}`
          : `DoH: ${body.status ?? "empty"}`;
      setDohResults((prev) => ({ ...prev, [fqdn]: text }));
    } catch {
      setDohResults((prev) => ({ ...prev, [fqdn]: "Lookup failed" }));
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
        setActionBanner(body.error ?? "Failed to delete DNS record.");
      } else {
        setActionBanner(`Deleted ${pendingDelete.fqdn} (${pendingDelete.type}).`);
        await loadLiveRecords();
      }
    } catch {
      setActionBanner("Network error while deleting record.");
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
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "warn", label: "Warn" },
    { id: "dead", label: "Dead" },
    { id: "unknown", label: "Pending" },
  ];

  const activeClaimHref =
    domainFilter !== "all"
      ? `/claim?domain=${encodeURIComponent(domainFilter)}`
      : "/claim";

  return (
    <div className="reveal-block space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
            Multi-Domain Directory
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Inspect registered subdomains across your root domains, verify live DNS via DoH, and copy records.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!authenticated ? (
            <button type="button" onClick={openLoginModal} className="chibi-secondary-btn">
              Unlock Admin View
            </button>
          ) : null}
          <Link href={activeClaimHref} className="chibi-cta">
            + New subdomain
          </Link>
        </div>
      </div>

      {/* Root Domain Switcher Pills */}
      <div
        role="group"
        aria-label="Filter by root domain"
        className="flex flex-wrap items-center gap-2"
      >
        <button
          type="button"
          aria-pressed={domainFilter === "all"}
          onClick={() => setDomainFilter("all")}
          className="min-h-10 cursor-pointer rounded-full border-2 px-4 text-xs font-bold"
          style={{
            backgroundColor: domainFilter === "all" ? "var(--sky)" : "var(--bg-surface)",
            color: domainFilter === "all" ? "#24324a" : "var(--text-primary)",
            borderColor: "var(--border-color)",
            boxShadow: domainFilter === "all" ? "0 2px 0 var(--border-color)" : "none",
          }}
        >
          All Domains ({rootDomains.length})
        </button>
        {rootDomains.map((dom) => {
          const active = domainFilter.toLowerCase() === dom.domain.toLowerCase();
          return (
            <button
              key={dom.domain}
              type="button"
              aria-pressed={active}
              onClick={() => setDomainFilter(dom.domain)}
              className="font-mono-code min-h-10 cursor-pointer rounded-full border-2 px-4 text-xs font-bold"
              style={{
                backgroundColor: active ? "var(--sky)" : "var(--bg-surface)",
                color: active ? "#24324a" : "var(--text-primary)",
                borderColor: "var(--border-color)",
                boxShadow: active ? "0 2px 0 var(--border-color)" : "none",
              }}
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
              Search subdomains, owners, or targets
            </label>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            >
              <circle cx="9" cy="9" r="6" />
              <path d="m14 14 3.5 3.5" />
            </svg>
            <input
              ref={searchInputRef}
              id="subdomain-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                domainFilter === "all"
                  ? "Search subdomains, @owner, CNAME, or IP..."
                  : `Search *.${domainFilter}...`
              }
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className="min-h-12 w-full rounded-full border-2 py-2.5 pr-12 pl-11 text-base sm:text-sm"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: "var(--border-color)",
                color: "var(--text-primary)",
                boxShadow: "0 3px 0 var(--shadow-tint)",
              }}
            />
            <kbd
              aria-hidden="true"
              className="font-mono-code pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 rounded-md border px-1.5 py-0.5 text-[11px] font-bold"
              style={{
                backgroundColor: "var(--bg-cream)",
                borderColor: "var(--border-color)",
                color: "var(--text-muted)",
              }}
            >
              /
            </kbd>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div
              className="flex flex-wrap items-center gap-1.5"
              role="group"
              aria-label="Filter by health status"
            >
              {statusButtons.map((btn) => {
                const active = statusFilter === btn.id;
                return (
                  <button
                    key={btn.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setStatusFilter(btn.id)}
                    className="min-h-10 cursor-pointer rounded-full border-2 px-4 text-xs font-bold transition-transform active:scale-95"
                    style={{
                      backgroundColor: active ? "var(--sky)" : "var(--bg-surface)",
                      color: active ? "#24324a" : "var(--text-primary)",
                      borderColor: "var(--border-color)",
                      boxShadow: active ? "0 2px 0 var(--border-color)" : "none",
                    }}
                  >
                    {btn.label}
                  </button>
                );
              })}
            </div>

            <span
              aria-live="polite"
              className="tabular-nums pl-1 text-xs font-semibold"
              style={{ color: "var(--text-muted)" }}
            >
              {filteredGitEntries.length} registry · {filteredLiveRecords.length} live
            </span>
          </div>
        </div>
      </search>

      {actionBanner ? (
        <div
          role="status"
          className="rounded-2xl border-2 px-4 py-3 text-xs font-bold"
          style={{
            backgroundColor: "var(--sky-soft)",
            borderColor: "#24324a",
            color: "#24324a",
          }}
        >
          {actionBanner}
        </div>
      ) : null}

      {/* Section 1: Git Registry Entries */}
      <section aria-labelledby="git-registry-heading" className="space-y-3">
        <h2 id="git-registry-heading" className="font-display text-lg font-extrabold">
          Tracked Subdomains
        </h2>

        {filteredGitEntries.length === 0 && filteredLiveRecords.length === 0 ? (
          <div className="chibi-row-card flex flex-col items-center gap-4 px-6 py-12 text-center">
            <img
              src="/images/chibi-mascot-search.png"
              alt="Cloud-pup mascot holding a magnifying glass"
              width={116}
              height={132}
              className="h-28 w-auto select-none"
            />
            <div className="space-y-1">
              <p className="font-display text-lg font-bold">No matching subdomains</p>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Try another keyword or reset the domain/status filters.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setDomainFilter("all");
                setStatusFilter("all");
              }}
              className="chibi-cta"
            >
              Show all subdomains
            </button>
          </div>
        ) : filteredGitEntries.length === 0 ? (
          <div className="chibi-row-card px-5 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
            No Git-tracked JSON files match this filter yet.
          </div>
        ) : (
          <ul role="list" className="space-y-3">
            {filteredGitEntries.map((entry) => {
              const firstType = entry.records[0]?.type ?? "CNAME";
              return (
                <li
                  key={entry.fqdn}
                  className="chibi-row-card flex flex-col gap-4 px-5 py-4 xl:flex-row xl:items-center xl:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <a
                        href={`https://${entry.fqdn}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono-code text-base font-bold underline decoration-2 underline-offset-4 hover:opacity-75"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {entry.fqdn}
                      </a>
                      <StatusBadge status={entry.health.status} reason={entry.health.reason} />
                    </div>
                    <p className="text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
                      {entry.description}
                    </p>
                    {dohResults[entry.fqdn] ? (
                      <p className="font-mono-code text-xs font-semibold" style={{ color: "var(--badge-live-fg)" }}>
                        {dohResults[entry.fqdn]}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                    <a
                      href={entry.owner.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold hover:opacity-80"
                      style={{
                        backgroundColor: "var(--bg-subtle)",
                        borderColor: "var(--border-color)",
                        color: "var(--text-primary)",
                      }}
                    >
                      <img
                        src={entry.owner.avatarUrl}
                        alt=""
                        width={20}
                        height={20}
                        className="rounded-full"
                      />
                      <span>@{entry.owner.github}</span>
                    </a>

                    <ul role="list" className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                      {entry.records.map((rec, idx) => {
                        const targetHost =
                          rec.label === entry.label
                            ? entry.fqdn
                            : `${rec.label}.${entry.rootDomain}`;
                        return (
                          <li
                            key={`${rec.label}-${rec.type}-${idx}`}
                            className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border px-3 py-1.5"
                            style={{
                              backgroundColor: "var(--bg-cream)",
                              borderColor: "var(--border-color)",
                            }}
                          >
                            <span
                              className="font-mono-code shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold"
                              style={{
                                backgroundColor: "var(--sky-soft)",
                                color: "#24324a",
                              }}
                            >
                              {rec.type}
                            </span>
                            {rec.label !== entry.label ? (
                              <span
                                className="font-mono-code shrink-0 text-xs font-semibold"
                                style={{ color: "var(--text-muted)" }}
                              >
                                {rec.label}
                              </span>
                            ) : null}
                            <code className="font-mono-code truncate text-xs font-medium">
                              {rec.value}
                            </code>
                            <CopyButton
                              value={rec.value}
                              label={`Copy ${rec.type} value for ${targetHost}`}
                            />
                          </li>
                        );
                      })}
                    </ul>

                    <button
                      type="button"
                      onClick={() => checkLiveDoh(entry.fqdn, firstType)}
                      className="chibi-secondary-btn"
                    >
                      Check DoH
                    </button>

                    <a
                      href={entry.editUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Edit ${entry.fqdn} on GitHub`}
                      className="chibi-secondary-btn"
                    >
                      Edit
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 2: Live DNS Provider API Records (Name.com / Cloudflare) */}
      <section aria-labelledby="live-provider-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="live-provider-heading" className="font-display text-lg font-extrabold">
              Live DNS Provider Records
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {authenticated
                ? "Admin mode unlocked: showing all live API records (protected apex/mail rows cannot be deleted here)."
                : "Public preview shows safe non-reserved A/AAAA/CNAME endpoints (60s cache). Unlock Admin for full view and delete controls."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadLiveRecords()}
            disabled={liveLoading}
            className="chibi-secondary-btn"
          >
            {liveLoading ? "Refreshing..." : "Refresh Live DNS"}
          </button>
        </div>

        {liveError ? (
          <div
            className="rounded-2xl border-2 px-4 py-3 text-xs font-bold"
            style={{
              backgroundColor: "var(--badge-warn-bg)",
              borderColor: "var(--badge-warn-fg)",
              color: "var(--badge-warn-fg)",
            }}
          >
            {liveError}
          </div>
        ) : filteredLiveRecords.length === 0 ? (
          <div className="chibi-row-card px-5 py-5 text-xs sm:text-sm" style={{ color: "var(--text-muted)" }}>
            No live API DNS records returned for this selection (or add{" "}
            <code className="font-mono-code font-bold">NAMECOM_USERNAME</code> /{" "}
            <code className="font-mono-code font-bold">NAMECOM_TOKEN</code> in Vercel Environment Variables).
          </div>
        ) : (
          <ul role="list" className="space-y-2.5">
            {filteredLiveRecords.map((rec, i) => (
              <li
                key={`${rec.domain}-${rec.id ?? rec.host}-${rec.type}-${i}`}
                className="chibi-row-card flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-mono-code rounded-md px-2 py-0.5 text-[11px] font-extrabold"
                      style={{ backgroundColor: "var(--sky-soft)", color: "#24324a" }}
                    >
                      {rec.type}
                    </span>
                    <span className="font-mono-code text-sm font-bold">{rec.fqdn}</span>
                    {rec.protected ? (
                      <span
                        className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: "var(--badge-muted-bg)",
                          color: "var(--badge-muted-fg)",
                        }}
                      >
                        Protected
                      </span>
                    ) : null}
                  </div>
                  <code
                    className="font-mono-code block truncate text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {rec.value} · TTL {rec.ttl}s
                  </code>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <CopyButton value={rec.value} label={`Copy ${rec.type} value for ${rec.fqdn}`} />
                  <button
                    type="button"
                    onClick={() => checkLiveDoh(rec.fqdn, rec.type)}
                    className="chibi-secondary-btn"
                  >
                    Check DoH
                  </button>
                  {rec.canDelete ? (
                    <button
                      type="button"
                      onClick={() => requestDeleteRecord(rec)}
                      className="inline-flex min-h-9 cursor-pointer items-center justify-center rounded-full border-2 px-3.5 text-xs font-bold"
                      style={{
                        backgroundColor: "var(--badge-dead-bg)",
                        borderColor: "var(--badge-dead-fg)",
                        color: "var(--badge-dead-fg)",
                      }}
                    >
                      Delete
                    </button>
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
        className="chibi-modal"
        onClose={() => {
          if (deleteDialogRef.current) deleteDialogRef.current.returnValue = "";
          setPendingDelete(null);
          setConfirmReservedDelete(false);
        }}
      >
        <div
          className="border-b-2 px-5 py-3.5"
          style={{ backgroundColor: "var(--badge-dead-bg)", borderColor: "#24324a" }}
        >
          <h2 id="delete-dialog-title" className="font-display text-lg font-extrabold" style={{ color: "var(--badge-dead-fg)" }}>
            Delete DNS Record?
          </h2>
        </div>

        <div className="space-y-4 p-5 text-sm">
          {pendingDelete ? (
            <p className="leading-relaxed">
              This will immediately delete live record{" "}
              <code className="font-mono-code font-bold">
                {pendingDelete.type} {pendingDelete.fqdn}
              </code>{" "}
              → <code className="font-mono-code">{pendingDelete.value}</code> from{" "}
              <strong>{pendingDelete.domain}</strong>.
            </p>
          ) : null}

          {pendingDelete?.reserved ? (
            <label
              className="flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 text-xs font-bold"
              style={{
                backgroundColor: "var(--badge-warn-bg)",
                borderColor: "var(--badge-warn-fg)",
                color: "var(--badge-warn-fg)",
              }}
            >
              <input
                type="checkbox"
                checked={confirmReservedDelete}
                onChange={(e) => setConfirmReservedDelete(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>
                This is a reserved system label. Confirm deleting it permanently.
              </span>
            </label>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              type="button"
              autoFocus
              onClick={() => deleteDialogRef.current?.close("cancel")}
              className="chibi-secondary-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={deleting || (Boolean(pendingDelete?.reserved) && !confirmReservedDelete)}
              onClick={() => void executeConfirmedDelete()}
              className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border-2 px-5 text-sm font-bold disabled:opacity-50"
              style={{
                backgroundColor: "var(--badge-dead-fg)",
                borderColor: "#24324a",
                color: "#ffffff",
              }}
            >
              {deleting ? "Deleting..." : "Confirm Delete"}
            </button>
          </div>
        </div>
      </dialog>
    </div>
  );
}
