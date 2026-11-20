"use client";

import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { SiteSubdomainItem, SubdomainHealth } from "@/lib/registry";
import { CopyButton } from "./copy-button";

interface RegistryExplorerProps {
  entries: SiteSubdomainItem[];
  rootDomain: string;
}

type StatusFilter = "all" | SubdomainHealth;

const STATUS_BADGE_MAP: Record<
  SubdomainHealth,
  { label: string; bgVar: string; fgVar: string }
> = {
  live: {
    label: "Live",
    bgVar: "var(--badge-live-bg)",
    fgVar: "var(--badge-live-fg)",
  },
  warn: {
    label: "Warn",
    bgVar: "var(--badge-warn-bg)",
    fgVar: "var(--badge-warn-fg)",
  },
  dead: {
    label: "Dead",
    bgVar: "var(--badge-dead-bg)",
    fgVar: "var(--badge-dead-fg)",
  },
  unknown: {
    label: "Pending",
    bgVar: "var(--badge-muted-bg)",
    fgVar: "var(--badge-muted-fg)",
  },
};

function StatusBadge({
  status,
  reason,
}: {
  status: SubdomainHealth;
  reason: string;
}) {
  const meta = STATUS_BADGE_MAP[status];
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider"
        style={{ backgroundColor: meta.bgVar, color: meta.fgVar }}
      >
        <span
          aria-hidden="true"
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: meta.fgVar }}
        />
        {meta.label}
      </span>
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {reason}
      </span>
    </div>
  );
}

export function RegistryExplorer({ entries, rootDomain }: RegistryExplorerProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const inputRef = useRef<HTMLInputElement>(null);

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
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = entries.filter((item) => {
    if (statusFilter !== "all" && item.health.status !== statusFilter) {
      return false;
    }
    if (!deferredQuery) return true;
    const matchesText =
      item.fqdn.toLowerCase().includes(deferredQuery) ||
      item.owner.github.toLowerCase().includes(deferredQuery) ||
      item.description.toLowerCase().includes(deferredQuery) ||
      item.records.some(
        (r) =>
          r.value.toLowerCase().includes(deferredQuery) ||
          r.type.toLowerCase().includes(deferredQuery),
      );
    return matchesText;
  });

  const filterButtons: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "warn", label: "Warn" },
    { id: "dead", label: "Dead" },
    { id: "unknown", label: "Pending" },
  ];

  return (
    <section aria-labelledby="directory-heading" className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="directory-heading" className="font-editorial text-2xl font-medium">
            Subdomain Directory
          </h2>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            DNS records are synced via Cloudflare and scanned daily for dangling targets.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:w-80">
          <label
            htmlFor="subdomain-search"
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Search registry
          </label>
          <div className="relative flex items-center">
            <input
              ref={inputRef}
              id="subdomain-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Filter ${rootDomain}, owner, or CNAME...`}
              className="w-full rounded-md px-3 py-2 pr-9 text-sm"
              style={{
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-color)",
                color: "var(--text-primary)",
              }}
            />
            <kbd
              aria-hidden="true"
              className="font-mono-code pointer-events-none absolute right-2.5 rounded px-1.5 py-0.5 text-[11px]"
              style={{
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-color)",
                color: "var(--text-muted)",
              }}
            >
              /
            </kbd>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by health status">
          {filterButtons.map((btn) => {
            const active = statusFilter === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(btn.id)}
                className="min-h-8 cursor-pointer rounded-md px-3 py-1 text-xs font-medium transition-colors"
                style={{
                  backgroundColor: active ? "var(--cta-bg)" : "var(--bg-surface)",
                  color: active ? "var(--cta-fg)" : "var(--text-muted)",
                  border: "1px solid var(--border-color)",
                }}
              >
                {btn.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs" aria-live="polite" style={{ color: "var(--text-muted)" }}>
          Showing {filtered.length} of {entries.length} subdomain{entries.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div
          className="editorial-card p-8 text-center text-sm"
          style={{ color: "var(--text-muted)" }}
        >
          No subdomains match your current filter. Clear the search or switch status filters.
        </div>
      ) : (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby="registry-table-caption"
          className="table-wrapper"
        >
          <table className="registry-table">
            <caption id="registry-table-caption" className="sr-only">
              Registered subdomains under {rootDomain}
            </caption>
            <thead>
              <tr>
                <th scope="col">Subdomain</th>
                <th scope="col">Owner</th>
                <th scope="col">Records</th>
                <th scope="col">Status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.label}>
                  <th scope="row">
                    <div className="flex flex-col gap-1">
                      <a
                        href={`https://${entry.fqdn}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono-code inline-flex items-center gap-1 text-sm font-medium underline decoration-1 underline-offset-4 hover:opacity-75"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {entry.fqdn}
                      </a>
                      <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>
                        {entry.description}
                      </span>
                    </div>
                  </th>
                  <td className="whitespace-nowrap">
                    <a
                      href={entry.owner.profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm hover:underline"
                      style={{ color: "var(--text-primary)" }}
                    >
                      <img
                        src={entry.owner.avatarUrl}
                        alt=""
                        width={22}
                        height={22}
                        className="rounded-full"
                        style={{ border: "1px solid var(--border-color)" }}
                      />
                      <span>@{entry.owner.github}</span>
                    </a>
                  </td>
                  <td className="min-w-[290px]">
                    <ul role="list" className="space-y-1.5">
                      {entry.records.map((rec, idx) => {
                        const targetHost =
                          rec.label === entry.label ? entry.fqdn : `${rec.label}.${rootDomain}`;
                        return (
                          <li
                            key={`${rec.label}-${rec.type}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5"
                            style={{
                              backgroundColor: "var(--bg-subtle)",
                              border: "1px solid var(--border-color)",
                            }}
                          >
                            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span
                                className="font-mono-code shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                                style={{
                                  backgroundColor: "var(--bg-surface)",
                                  border: "1px solid var(--border-color)",
                                }}
                              >
                                {rec.type}
                              </span>
                              {rec.label !== entry.label ? (
                                <span
                                  className="font-mono-code shrink-0 text-xs"
                                  style={{ color: "var(--text-muted)" }}
                                >
                                  {rec.label}
                                </span>
                              ) : null}
                              <code className="font-mono-code text-xs [overflow-wrap:anywhere]">
                                {rec.value}
                              </code>
                            </div>
                            <CopyButton
                              value={rec.value}
                              label={`Copy ${rec.type} value for ${targetHost}`}
                            />
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                  <td className="whitespace-nowrap">
                    <StatusBadge status={entry.health.status} reason={entry.health.reason} />
                  </td>
                  <td className="whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <a
                        href={entry.editUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Edit ${entry.fqdn} on GitHub`}
                        className="inline-flex min-h-7 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium hover:opacity-80"
                        style={{
                          border: "1px solid var(--border-color)",
                          backgroundColor: "var(--bg-subtle)",
                          color: "var(--text-primary)",
                        }}
                      >
                        Edit PR
                      </a>
                      <a
                        href={entry.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`View JSON definition for ${entry.fqdn}`}
                        className="text-xs underline underline-offset-4 hover:opacity-75"
                        style={{ color: "var(--text-muted)" }}
                      >
                        JSON
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
