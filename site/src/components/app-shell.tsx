"use client";

import {
  ArrowUpRight,
  GlobeHemisphereWest,
  Heartbeat,
  House,
  List,
  LockSimple,
  LockSimpleOpen,
  PlusCircle,
  Stack,
  X,
} from "@phosphor-icons/react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { SiteRootDomainMeta } from "@/lib/registry";
import {
  AdminSessionProvider,
  useAdminSession,
  type InitialAdminState,
} from "./admin-context";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { LanguageSwitcher } from "./ui/language-switcher";
import { ThemeToggle } from "./ui/theme-toggle";

interface AppShellProps {
  rootDomains: SiteRootDomainMeta[];
  repository: string;
  initialAdminState: InitialAdminState;
  children: ReactNode;
}

type NavKey = "overview" | "directory" | "claim" | "health";
type TitleKey = "overviewTitle" | "directoryTitle" | "claimTitle" | "healthTitle";

interface NavItem {
  href: string;
  labelKey: NavKey;
  titleKey: TitleKey;
  renderIcon: (active: boolean) => ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "/",
    labelKey: "overview",
    titleKey: "overviewTitle",
    renderIcon: (active) => (
      <House size={17} weight={active ? "duotone" : "bold"} aria-hidden="true" />
    ),
  },
  {
    href: "/directory",
    labelKey: "directory",
    titleKey: "directoryTitle",
    renderIcon: (active) => (
      <Stack size={17} weight={active ? "duotone" : "bold"} aria-hidden="true" />
    ),
  },
  {
    href: "/claim",
    labelKey: "claim",
    titleKey: "claimTitle",
    renderIcon: (active) => (
      <PlusCircle size={17} weight={active ? "duotone" : "bold"} aria-hidden="true" />
    ),
  },
  {
    href: "/health",
    labelKey: "health",
    titleKey: "healthTitle",
    renderIcon: (active) => (
      <Heartbeat size={17} weight={active ? "duotone" : "bold"} aria-hidden="true" />
    ),
  },
];

function isRouteActive(pathname: string, href: string): boolean {
  const normalized = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  return normalized === href;
}

function isPlainLeftClick(e: MouseEvent<HTMLAnchorElement>): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function NavStatusDot({ active }: { active: boolean }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent-terracotta)] transition-opacity ${
        pending ? "animate-pulse opacity-100" : active ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}

function SidebarContents({
  pathname,
  activePath,
  rootDomains,
  repository,
  onPrefetchRoute,
  onOptimisticNavigate,
  onNavigate,
}: {
  pathname: string;
  activePath: string;
  rootDomains: SiteRootDomainMeta[];
  repository: string;
  onPrefetchRoute: (href: string) => void;
  onOptimisticNavigate: (href: string) => void;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const { authenticated, configured, openLoginModal, preloadLoginModal, logout } =
    useAdminSession();
  const repoUrl = `https://github.com/${repository}`;

  return (
    <div className="flex h-full flex-col justify-between gap-6 p-4">
      <div className="space-y-6">
        {/* Minimal Brand Anchor */}
        <Link
          href="/"
          prefetch={true}
          onPointerEnter={() => onPrefetchRoute("/")}
          onClick={(e) => {
            if (isPlainLeftClick(e) && !isRouteActive(pathname, "/")) {
              onOptimisticNavigate("/");
            }
            onNavigate?.();
          }}
          className="group flex items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2.5 no-underline transition-colors hover:border-[var(--border-strong)]"
        >
          <span className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]">
              <GlobeHemisphereWest size={16} weight="duotone" aria-hidden="true" />
            </span>
            <span className="text-sm font-bold tracking-tight text-[var(--text-primary)]">
              FDOMAIN
            </span>
          </span>
          <span className="font-mono-code rounded border border-[var(--border-color)] bg-[var(--bg-paper)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-muted)]">
            {tCommon("domainCount", { count: rootDomains.length })}
          </span>
        </Link>

        <nav aria-label={t("mainAriaLabel")}>
          <ul role="list" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = isRouteActive(activePath, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={true}
                    aria-current={active ? "page" : undefined}
                    onPointerEnter={() => onPrefetchRoute(item.href)}
                    onFocus={() => onPrefetchRoute(item.href)}
                    onClick={(e) => {
                      if (isPlainLeftClick(e) && !isRouteActive(pathname, item.href)) {
                        onOptimisticNavigate(item.href);
                      }
                      onNavigate?.();
                    }}
                    className="editorial-nav-link"
                  >
                    <span
                      className={
                        active ? "text-[var(--accent-terracotta)]" : "text-[var(--text-muted)]"
                      }
                    >
                      {item.renderIcon(active)}
                    </span>
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    <NavStatusDot active={active} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Slim, quiet sidebar footer (Quota moved exclusively to /health) */}
      <div className="space-y-2 border-t border-[var(--border-color)] pt-3.5">
        {authenticated ? (
          <div className="isolated-card flex items-center justify-between gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="live" className="shrink-0 px-2 py-0.5 text-[10px]">
                {t("adminUnlocked")}
              </Badge>
              <span className="truncate text-xs font-medium text-[var(--text-secondary)]">
                {t("adminShort")}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void logout();
                onNavigate?.();
              }}
              className="min-h-7 shrink-0 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <LockSimple size={13} weight="bold" aria-hidden="true" />
              <span>{t("lockAdminSession")}</span>
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onMouseEnter={preloadLoginModal}
            onFocus={preloadLoginModal}
            onClick={() => {
              onNavigate?.();
              openLoginModal();
            }}
            className="w-full justify-between gap-2 px-2.5"
          >
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <LockSimpleOpen size={14} weight="bold" aria-hidden="true" className="shrink-0" />
              <span className="truncate">{t("unlockAdminMode")}</span>
            </span>
            <Badge
              variant={configured ? "neutral" : "warn"}
              className="shrink-0 px-2 py-0 text-[10px]"
            >
              {configured ? t("adminLocked") : t("adminEnvNeeded")}
            </Badge>
          </Button>
        )}

        <Button asChild variant="ghost" size="sm" className="w-full justify-between px-3">
          <a href={repoUrl} target="_blank" rel="noopener noreferrer">
            <span className="text-xs text-[var(--text-muted)]">{t("githubRepo")}</span>
            <ArrowUpRight size={13} weight="bold" aria-hidden="true" className="text-[var(--text-muted)]" />
          </a>
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ initialAdminState, ...rest }: AppShellProps) {
  return (
    <AdminSessionProvider initialState={initialAdminState}>
      <AppShellInner {...rest} initialAdminState={initialAdminState} />
    </AdminSessionProvider>
  );
}

function AppShellInner({ rootDomains, repository, children }: AppShellProps) {
  const t = useTranslations("nav");
  const tMeta = useTranslations("meta");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const [optimisticPath, setOptimisticPath] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const drawerRef = useRef<HTMLDialogElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const activePath = optimisticPath ?? pathname;
  const currentNav = NAV_ITEMS.find((item) => isRouteActive(activePath, item.href)) ?? NAV_ITEMS[0]!;
  const isHomeRoute = isRouteActive(activePath, "/");

  useEffect(() => {
    setOptimisticPath(null);
  }, [pathname]);

  function prefetchRoute(href: string) {
    if (!isRouteActive(pathname, href)) {
      router.prefetch(href);
    }
  }

  useEffect(() => {
    document.title = tMeta(currentNav.titleKey);
  }, [currentNav.titleKey, locale, tMeta]);

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
        const ratio = Math.max(
          0,
          Math.min(1, 1 - scroller.scrollLeft / Math.max(sheet.offsetWidth, 1)),
        );
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

  useEffect(() => {
    if (drawerRef.current?.open) {
      drawerRef.current.close();
      setDrawerOpen(false);
    }
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_minmax(0,1fr)]">
      {/* Desktop Persistent Sidebar */}
      <aside
        aria-label={t("sidebarAriaLabel")}
        className="hidden border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] lg:block"
      >
        <div className="sticky top-0 h-dvh overflow-y-auto">
          <SidebarContents
            pathname={pathname}
            activePath={activePath}
            rootDomains={rootDomains}
            repository={repository}
            onPrefetchRoute={prefetchRoute}
            onOptimisticNavigate={setOptimisticPath}
          />
        </div>
      </aside>

      {/* Mobile Native <dialog> Navigation Drawer */}
      <dialog
        ref={drawerRef}
        id="mobile-nav-drawer"
        aria-label={t("drawerAriaLabel")}
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
            <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {tCommon("menu")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                autoFocus
                aria-label={tCommon("closeMenu")}
                onClick={closeDrawer}
              >
                <X size={16} weight="bold" aria-hidden="true" />
              </Button>
            </div>

            <SidebarContents
              pathname={pathname}
              activePath={activePath}
              rootDomains={rootDomains}
              repository={repository}
              onPrefetchRoute={prefetchRoute}
              onOptimisticNavigate={setOptimisticPath}
              onNavigate={closeDrawer}
            />
          </div>
        </div>
      </dialog>

      {/* Main Column */}
      <div className="flex min-h-dvh min-w-0 flex-col">
        <header
          className="sticky top-0 z-20 border-b border-[var(--border-color)] backdrop-blur-md"
          style={{ backgroundColor: "var(--header-bg)" }}
        >
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:gap-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="iconSm"
                aria-label={tCommon("openMenu")}
                aria-expanded={drawerOpen}
                aria-controls="mobile-nav-drawer"
                onClick={openDrawer}
                className="shrink-0 lg:hidden"
              >
                <List size={18} weight="bold" aria-hidden="true" />
              </Button>

              <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                {t(currentNav.labelKey)}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <ThemeToggle />
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        <main
          id="registry-main"
          tabIndex={-1}
          className={
            isHomeRoute
              ? "flex min-w-0 flex-1 flex-col"
              : "mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
