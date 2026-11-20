"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import type { SiteSubdomainItem, SubdomainHealth } from "@/lib/registry";
import { CopyButton } from "./copy-button";
import { StatusBadge } from "./status-badge";

interface DirectoryViewProps {
  entries: SiteSubdomainItem[];
  rootDomain: string;
}

type StatusFilter = "all" | SubdomainHealth;

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function DirectoryView({ entries, rootDomain }: DirectoryViewProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const filtered = entries.filter((item) => {
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

  const filterButtons: Array<{ id: StatusFilter; label: string }> = [
    { id: "all", label: "All" },
    { id: "live", label: "Live" },
    { id: "warn", label: "Warn" },
    { id: "dead", label: "Dead" },
    { id: "unknown", label: "Pending" },
  ];

  return (
    <div className="reveal-block space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
            Registered Subdomains
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            Look up DNS records, copy CNAME/IP targets, or jump straight to GitHub to update your file.
          </p>
        </div>
        <Link href="/claim" className="chibi-secondary-btn">
          + New subdomain
        </Link>
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
              placeholder={`Search ${rootDomain}, @owner, or target...`}
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
              {filterButtons.map((btn) => {
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
              {filtered.length}/{entries.length}
            </span>
          </div>
        </div>
      </search>

      {filtered.length === 0 ? (
        <div className="chibi-row-card flex flex-col items-center gap-4 px-6 py-12 text-center">
          <img
            src={`${BASE_PATH}/images/chibi-mascot-search.png`}
            alt="Cloud-pup mascot holding a magnifying glass"
            width={116}
            height={132}
            className="h-28 w-auto select-none"
          />
          <div className="space-y-1">
            <p className="font-display text-lg font-bold">No matching subdomains</p>
            <p className="text-sm" style={{ color: "var(--text-muted)" }}>
              Try another keyword or reset the status filter.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="chibi-cta"
          >
            Show all subdomains
          </button>
        </div>
      ) : (
        <ul role="list" className="space-y-3">
          {filtered.map((entry) => (
            <li
              key={entry.label}
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
                      rec.label === entry.label ? entry.fqdn : `${rec.label}.${rootDomain}`;
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
          ))}
        </ul>
      )}
    </div>
  );
}
