"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { SiteRootDomainMeta } from "@/lib/registry";
import { AdminSessionProvider, useAdminSession } from "./admin-context";

interface AppShellProps {
  rootDomains: SiteRootDomainMeta[];
  repository: string;
  totalDnsRecords: number;
  maxTotalRecords: number;
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    label: "Overview",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9.5 10 3.5l7 6V17a1 1 0 0 1-1 1h-4v-5H8v5H4a1 1 0 0 1-1-1V9.5Z" />
      </svg>
    ),
  },
  {
    href: "/directory",
    label: "Directory",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="14" height="3.5" rx="1.5" />
        <rect x="3" y="9.5" width="14" height="3.5" rx="1.5" />
        <rect x="3" y="15" width="10" height="2.5" rx="1.25" />
      </svg>
    ),
  },
  {
    href: "/claim",
    label: "Claim Subdomain",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="10" cy="10" r="7.5" />
        <path d="M10 6.8v6.4M6.8 10h6.4" />
      </svg>
    ),
  },
  {
    href: "/health",
    label: "Health & Quota",
    icon: (
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 10h3.5l2.2-5 3.6 10 2.2-5h3.5" />
      </svg>
    ),
  },
];

function isRouteActive(pathname: string, href: string): boolean {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return normalized === href;
}

function SidebarContents({
  pathname,
  rootDomains,
  repository,
  totalDnsRecords,
  maxTotalRecords,
  onNavigate,
}: {
  pathname: string;
  rootDomains: SiteRootDomainMeta[];
  repository: string;
  totalDnsRecords: number;
  maxTotalRecords: number;
  onNavigate?: () => void;
}) {
  const { authenticated, configured, openLoginModal, logout } = useAdminSession();
  const quotaPct = Math.min(100, Math.round((totalDnsRecords / maxTotalRecords) * 100));
  const repoUrl = `https://github.com/${repository}`;

  return (
    <div className="flex h-full flex-col justify-between gap-6 p-4">
      <div className="space-y-5">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex items-center justify-between gap-2 rounded-2xl border-2 px-3.5 py-2.5 no-underline"
          style={{
            backgroundColor: "var(--sky)",
            borderColor: "#24324a",
            color: "#24324a",
            boxShadow: "0 3px 0 #24324a",
          }}
        >
          <span className="font-display flex items-center gap-2 text-base font-extrabold">
            <span
              aria-hidden="true"
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: "var(--mango)", border: "2px solid #24324a" }}
            />
            FDOMAIN
          </span>
          <span
            className="font-mono-code rounded-full border px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: "#fffdf6", borderColor: "#24324a" }}
          >
            {rootDomains.length} {rootDomains.length === 1 ? "domain" : "domains"}
          </span>
        </Link>

        <nav aria-label="Main navigation">
          <ul role="list" className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const active = isRouteActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    onClick={onNavigate}
                    className="chibi-nav-link"
                  >
                    {item.icon}
                    <span className="flex-1">{item.label}</span>
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: "#24324a" }}
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      <div className="space-y-3">
        <div
          className="rounded-2xl border-2 p-3.5"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-color)",
            boxShadow: "0 3px 0 var(--shadow-tint)",
          }}
        >
          <div className="flex items-center justify-between gap-2 text-xs font-bold">
            <span>Admin Auto-DNS</span>
            <span
              className="rounded-full px-2 py-0.5 text-[11px]"
              style={{
                backgroundColor: authenticated ? "var(--badge-live-bg)" : "var(--badge-muted-bg)",
                color: authenticated ? "var(--badge-live-fg)" : "var(--badge-muted-fg)",
              }}
            >
              {authenticated ? "Unlocked" : configured ? "Locked" : "Env Needed"}
            </span>
          </div>
          {authenticated ? (
            <button
              type="button"
              onClick={() => {
                void logout();
                onNavigate?.();
              }}
              className="chibi-secondary-btn mt-2.5 w-full"
            >
              Lock Admin Session
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onNavigate?.();
                openLoginModal();
              }}
              className="chibi-secondary-btn mt-2.5 w-full"
            >
              Unlock Admin Mode
            </button>
          )}
        </div>

        <div
          className="rounded-2xl border-2 p-3.5"
          style={{
            backgroundColor: "var(--bg-surface)",
            borderColor: "var(--border-color)",
            boxShadow: "0 3px 0 var(--shadow-tint)",
          }}
        >
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Registry Quota</span>
            <span className="tabular-nums font-mono-code">
              {totalDnsRecords}/{maxTotalRecords}
            </span>
          </div>
          <div
            className="mt-2 h-2 w-full overflow-hidden rounded-full border"
            style={{ backgroundColor: "var(--bg-subtle)", borderColor: "var(--border-color)" }}
          >
            <div
              className="h-full"
              style={{ width: `${quotaPct}%`, backgroundColor: "var(--mint)" }}
            />
          </div>
          <p className="mt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
            DNS-only · Free zone safe cap
          </p>
        </div>

        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="chibi-secondary-btn w-full"
        >
          GitHub Repository ↗
        </a>
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  return (
    <AdminSessionProvider>
      <AppShellInner {...props} />
    </AdminSessionProvider>
  );
}

function AppShellInner({
  rootDomains,
  repository,
  totalDnsRecords,
  maxTotalRecords,
  children,
}: AppShellProps) {
  const pathname = usePathname() || "/";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const drawerRef = useRef<HTMLDialogElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const currentNav = NAV_ITEMS.find((item) => isRouteActive(pathname, item.href)) ?? NAV_ITEMS[0]!;

  useEffect(() => {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    const sheet = sheetRef.current;
    if (!drawer || !scroller || !sheet) return;

    const visibleThreshold = 1 / Math.max(window.innerWidth, 320);

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (!entry) return;
        if (entry.intersectionRatio < visibleThreshold && drawer.open) {
          drawer.close();
          setDrawerOpen(false);
        } else if (entry.intersectionRatio >= 0.99 && drawer.open) {
          setDrawerOpen(true);
        }
      },
      { root: drawer, threshold: [visibleThreshold, 1] },
    );

    observer.observe(sheet);

    if (!CSS.supports("animation-timeline: scroll()")) {
      const onScroll = () => {
        const ratio = Math.max(0, Math.min(1, 1 - scroller.scrollLeft / Math.max(sheet.offsetWidth, 1)));
        drawer.style.setProperty("--drawer-backdrop", String(ratio));
      };
      scroller.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        observer.disconnect();
        scroller.removeEventListener("scroll", onScroll);
      };
    }

    return () => observer.disconnect();
  }, []);

  async function openDrawer() {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    if (!drawer || !scroller) return;
    drawer.showModal();
    setDrawerOpen(true);

    if (!CSS.supports("scroll-initial-target", "nearest")) {
      scroller.scrollTo({ left: scroller.offsetWidth, behavior: "instant" });
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }
    scroller.scrollTo({ left: 0, behavior: "auto" });
  }

  function closeDrawer() {
    const drawer = drawerRef.current;
    const scroller = scrollerRef.current;
    if (!drawer || !drawer.open) return;
    if (!scroller) {
      drawer.close();
      setDrawerOpen(false);
      return;
    }
    scroller.scrollTo({ left: scroller.offsetWidth, behavior: "auto" });
  }

  // Ensure route change closes mobile drawer cleanly
  useEffect(() => {
    if (drawerRef.current?.open) {
      drawerRef.current.close();
      setDrawerOpen(false);
    }
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Desktop Persistent Sidebar */}
      <aside
        aria-label="Sidebar navigation"
        className="hidden border-r-2 lg:block"
        style={{
          backgroundColor: "var(--sidebar-bg)",
          borderColor: "var(--border-color)",
        }}
      >
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <SidebarContents
            pathname={pathname}
            rootDomains={rootDomains}
            repository={repository}
            totalDnsRecords={totalDnsRecords}
            maxTotalRecords={maxTotalRecords}
          />
        </div>
      </aside>

      {/* Mobile Native <dialog> Navigation Drawer */}
      <dialog
        ref={drawerRef}
        id="mobile-nav-drawer"
        aria-label="Navigation drawer"
        className="nav-drawer lg:hidden"
        onClick={(e) => {
          if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
            closeDrawer();
          }
        }}
        onCancel={(e) => {
          if (e.cancelable) {
            e.preventDefault();
            closeDrawer();
          }
        }}
      >
        <div ref={scrollerRef} className="nav-drawer-scroller">
          <div ref={sheetRef} className="nav-drawer-sheet">
            <div
              className="flex items-center justify-between border-b-2 px-4 py-3"
              style={{
                backgroundColor: "var(--header-bg)",
                borderColor: "var(--border-color)",
              }}
            >
              <span className="font-display text-base font-extrabold" style={{ color: "#24324a" }}>
                Menu
              </span>
              <button
                type="button"
                autoFocus
                aria-label="Close menu"
                onClick={closeDrawer}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 text-sm font-bold"
                style={{
                  backgroundColor: "var(--bg-cream)",
                  borderColor: "#24324a",
                  color: "#24324a",
                }}
              >
                ✕
              </button>
            </div>

            <SidebarContents
              pathname={pathname}
              rootDomains={rootDomains}
              repository={repository}
              totalDnsRecords={totalDnsRecords}
              maxTotalRecords={maxTotalRecords}
              onNavigate={closeDrawer}
            />
          </div>
        </div>
      </dialog>

      {/* Main Column */}
      <div className="flex min-w-0 flex-col">
        <header
          className="sticky top-0 z-20 border-b-2"
          style={{
            backgroundColor: "var(--header-bg)",
            borderColor: "var(--border-color)",
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2.5 px-4 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                aria-label="Open menu"
                aria-expanded={drawerOpen}
                aria-controls="mobile-nav-drawer"
                onClick={openDrawer}
                className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 lg:hidden"
                style={{
                  backgroundColor: "var(--bg-cream)",
                  borderColor: "#24324a",
                  color: "#24324a",
                  boxShadow: "0 2px 0 #24324a",
                }}
              >
                <svg
                  aria-hidden="true"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                >
                  <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
                </svg>
              </button>

              <span className="font-display truncate text-base font-extrabold sm:text-lg" style={{ color: "#24324a" }}>
                {currentNav.label}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2.5">
              <span
                className="font-mono-code hidden rounded-full border-2 px-3 py-1 text-xs font-bold sm:inline-block lg:hidden"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "#24324a",
                  color: "#24324a",
                }}
              >
                {rootDomains.map((d) => d.domain).join(" · ")}
              </span>
              {!isRouteActive(pathname, "/claim") ? (
                <Link href="/claim" className="chibi-cta whitespace-nowrap">
                  + Claim<span className="hidden sm:inline"> Subdomain</span>
                </Link>
              ) : (
                <Link href="/directory" className="chibi-secondary-btn whitespace-nowrap">
                  <span className="hidden sm:inline">View </span>Directory
                </Link>
              )}
            </div>
          </div>
        </header>

        <main
          id="registry-main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
