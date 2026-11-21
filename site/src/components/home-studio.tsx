"use client";

import {
  ArrowRight,
  CaretDown,
  Check,
  CircleNotch,
  GlobeHemisphereWest,
  WarningCircle,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AvailabilityPayload } from "@/lib/availability";
import { isValidSubdomainLabel } from "@/lib/dns-rules";
import type { SiteRootDomainMeta } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useAdminSession } from "./admin-context";
import type { PopupTarget } from "./subdomain-setup-dialog";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const importSetupDialog = () =>
  import("./subdomain-setup-dialog").then((mod) => mod.SubdomainSetupDialog);

const LazySubdomainSetupDialog = dynamic(importSetupDialog, {
  ssr: false,
});

interface HomeStudioProps {
  rootDomains: SiteRootDomainMeta[];
  defaultRootDomain: string;
}

type InlineFeedback =
  | { kind: "error"; text: string; suggestions?: string[] }
  | { kind: "reserved-admin"; text: string; payload: AvailabilityPayload };

function buildSuggestions(label: string): string[] {
  const base = label.replace(/-\d+$/, "").slice(0, 24);
  const candidates = [`${base}-app`, `my-${base}`].filter(
    (s) => s !== label && isValidSubdomainLabel(s),
  );
  return candidates.slice(0, 2);
}

export function HomeStudio({ rootDomains, defaultRootDomain }: HomeStudioProps) {
  const t = useTranslations("home");
  const tDomains = useTranslations("domains");
  const { authenticated, capabilities } = useAdminSession();

  const [selectedDomain, setSelectedDomain] = useState(defaultRootDomain);
  const [label, setLabel] = useState("");
  const [checking, setChecking] = useState(false);
  const [feedback, setFeedback] = useState<InlineFeedback | null>(null);
  const [popupMounted, setPopupMounted] = useState(false);
  const [popupTarget, setPopupTarget] = useState<PopupTarget | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const activeDomainMeta =
    rootDomains.find((d) => d.domain.toLowerCase() === selectedDomain.toLowerCase()) ??
    rootDomains[0]!;

  // Fixed selector min-width prevents bar jitter when switching between root domains
  const maxDomainChars = useMemo(
    () => Math.max(...rootDomains.map((d) => d.domain.length), 12),
    [rootDomains],
  );

  // Clear stale public "reserved" notice if the user unlocks Admin
  useEffect(() => {
    setFeedback((prev) => (prev?.kind === "reserved-admin" || prev?.kind === "error" ? null : prev));
  }, [authenticated]);

  const preloadDialog = useCallback(() => {
    void importSetupDialog();
  }, []);

  function openSetupPopup(payload: AvailabilityPayload, isReservedOverride = false) {
    setPopupMounted(true);
    setPopupTarget({
      domainMeta: activeDomainMeta,
      label: payload.label,
      fqdn: payload.fqdn,
      availabilityStatus: payload.status,
      providerMode: payload.providerMode,
      isReservedOverride,
    });
  }

  async function runAvailabilityCheck(rawInput: string) {
    const clean = rawInput.trim().toLowerCase();
    setFeedback(null);

    if (!clean) {
      setFeedback({ kind: "error", text: t("errEmpty") });
      inputRef.current?.focus();
      return;
    }

    if (!isValidSubdomainLabel(clean)) {
      setFeedback({ kind: "error", text: t("errInvalid") });
      inputRef.current?.focus();
      return;
    }

    preloadDialog();
    setChecking(true);
    try {
      const res = await fetch(
        `/api/dns/availability?domain=${encodeURIComponent(activeDomainMeta.domain)}&label=${encodeURIComponent(clean)}`,
        { cache: "no-store" },
      );

      if (!res.ok) {
        setFeedback({ kind: "error", text: t("errNetwork") });
        return;
      }

      const payload = (await res.json()) as AvailabilityPayload;

      if (payload.available) {
        setLabel(payload.label);
        openSetupPopup(payload, false);
        return;
      }

      if (payload.status === "invalid") {
        setFeedback({ kind: "error", text: t("errInvalid") });
      } else if (payload.status === "protected") {
        setFeedback({ kind: "error", text: t("errProtected", { fqdn: payload.fqdn }) });
      } else if (payload.status === "reserved") {
        if (payload.canOverride) {
          setFeedback({
            kind: "reserved-admin",
            text: t("errReservedAdmin", { fqdn: payload.fqdn }),
            payload,
          });
        } else {
          setFeedback({
            kind: "error",
            text: t("errReservedPublic", { fqdn: payload.fqdn }),
          });
        }
      } else {
        setFeedback({
          kind: "error",
          text: t("errTaken", { fqdn: payload.fqdn }),
          suggestions: buildSuggestions(payload.label),
        });
      }
    } catch {
      setFeedback({ kind: "error", text: t("errNetwork") });
    } finally {
      setChecking(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runAvailabilityCheck(label);
  }

  return (
    <section
      aria-labelledby="home-hero-title"
      className="home-ambient-canvas reveal-block flex min-h-[calc(100dvh-3.5rem)] w-full flex-1 flex-col items-center justify-center px-4 py-12 sm:px-6 lg:px-8"
    >
      {/* Subtle architectural concentric ring geometry behind the form */}
      <svg
        aria-hidden="true"
        viewBox="0 0 800 800"
        fill="none"
        className="pointer-events-none absolute top-[44%] left-1/2 -z-10 h-[min(46rem,115vw)] w-[min(46rem,115vw)] -translate-x-1/2 -translate-y-1/2 select-none"
      >
        <circle cx="400" cy="400" r="180" stroke="var(--ring-stroke-color)" strokeWidth="1" />
        <circle
          cx="400"
          cy="400"
          r="285"
          stroke="var(--ring-stroke-color)"
          strokeWidth="1"
          strokeDasharray="4 6"
        />
        <circle cx="400" cy="400" r="385" stroke="var(--ring-stroke-color)" strokeWidth="1" />
      </svg>

      <div className="mx-auto w-full max-w-2xl -translate-y-4 space-y-7 text-center sm:-translate-y-6">
        {/* Quiet Eyebrow */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]">
          <GlobeHemisphereWest
            size={14}
            weight="duotone"
            aria-hidden="true"
            className="text-[var(--accent-terracotta)]"
          />
          <span>{t("eyebrow", { count: rootDomains.length })}</span>
        </div>

        {/* Calm Modern Display Headline (crisp Vietnamese diacritics) */}
        <div className="space-y-3">
          <h1
            id="home-hero-title"
            className="text-3xl font-bold tracking-[-0.03em] text-[var(--text-primary)] sm:text-[2.75rem] sm:leading-[1.12]"
          >
            {t("title")}
          </h1>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-[var(--text-muted)] sm:text-[15px]">
            {t("subtitle")}
          </p>
        </div>

        {/* The Single Focal Input Form — concentric 16px outer / 10px inner geometry, 44px uniform height */}
        <form onSubmit={handleSubmit} noValidate className="mx-auto w-full max-w-[38rem] space-y-3">
          <div className="home-form-bar p-1.5">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0">
              {/* Subdomain Input + Seamless Hairline Divider + Flush Domain Selector */}
              <div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-0">
                <label htmlFor="home-subdomain-input" className="sr-only">
                  {t("inputLabel")}
                </label>
                <input
                  ref={inputRef}
                  id="home-subdomain-input"
                  name="subdomain"
                  type="text"
                  value={label}
                  onFocus={preloadDialog}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (feedback) setFeedback(null);
                  }}
                  placeholder={t("inputPlaceholder")}
                  aria-invalid={feedback?.kind === "error" ? "true" : "false"}
                  aria-describedby="home-form-feedback"
                  autoCorrect="off"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono-code h-11 min-w-0 flex-1 bg-transparent px-3.5 text-base font-medium text-[var(--text-primary)] placeholder:font-sans placeholder:font-normal placeholder:text-[var(--text-muted)] focus:outline-none focus-visible:outline-none sm:px-4 sm:text-[15px]"
                />

                <span
                  aria-hidden="true"
                  className="hidden h-5 w-px shrink-0 bg-[var(--border-color)] sm:block"
                />

                {/* Flush Multi-Domain Dropdown Selector (zero nested box clutter on desktop) */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("domainPickerAria")}
                      className="font-mono-code inline-flex h-11 shrink-0 cursor-pointer items-center justify-between gap-1.5 rounded-[10px] bg-[var(--bg-subtle)] px-3 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] sm:mx-1 sm:bg-transparent sm:hover:bg-[var(--bg-subtle)] sm:text-[13px]"
                      style={{ minWidth: `calc(${maxDomainChars}ch + 2.25rem)` }}
                    >
                      <span className="truncate">.{activeDomainMeta.domain}</span>
                      <CaretDown
                        size={13}
                        weight="bold"
                        aria-hidden="true"
                        className="shrink-0 text-[var(--text-muted)]"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[16rem]">
                    <DropdownMenuLabel>{t("domainMenuLabel")}</DropdownMenuLabel>
                    <DropdownMenuRadioGroup
                      value={activeDomainMeta.domain}
                      onValueChange={(next) => {
                        setSelectedDomain(next);
                        setFeedback(null);
                      }}
                    >
                      {rootDomains.map((dom) => {
                        const cap = capabilities.find(
                          (c) => c.domain.toLowerCase() === dom.domain.toLowerCase(),
                        );
                        const isAuto = cap?.mode === "auto-ready";
                        const isSelected =
                          dom.domain.toLowerCase() === activeDomainMeta.domain.toLowerCase();
                        return (
                          <DropdownMenuRadioItem key={dom.domain} value={dom.domain}>
                            <span className="flex min-w-0 items-center gap-2">
                              <Check
                                size={13}
                                weight="bold"
                                aria-hidden="true"
                                className={cn(
                                  "shrink-0 text-[var(--accent-terracotta)]",
                                  isSelected ? "opacity-100" : "opacity-0",
                                )}
                              />
                              <span className="font-mono-code truncate text-xs font-semibold text-[var(--text-primary)]">
                                .{dom.domain}
                              </span>
                            </span>
                            <Badge variant={isAuto ? "live" : "warn"} className="px-2 py-0 text-[10px]">
                              {isAuto ? tDomains("modeAuto") : tDomains("modeCopy")}
                            </Badge>
                          </DropdownMenuRadioItem>
                        );
                      })}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Primary Continue CTA — exact 44px height & 10px concentric corner radius */}
              <Button
                type="submit"
                size="lg"
                disabled={checking}
                className="h-11 w-full shrink-0 rounded-[10px] px-5 sm:min-w-[8.75rem] sm:w-auto"
              >
                {checking ? (
                  <>
                    <CircleNotch
                      size={15}
                      weight="bold"
                      aria-hidden="true"
                      className="animate-spin"
                    />
                    <span>{t("checkingAction")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("continueAction")}</span>
                    <ArrowRight size={15} weight="bold" aria-hidden="true" />
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Fixed-height inline feedback slot (0px layout shift across idle/error/suggestions) */}
          <div
            id="home-form-feedback"
            aria-live="polite"
            className="flex min-h-[4.25rem] flex-col items-center justify-start gap-2 pt-1 text-xs"
          >
            {feedback === null ? (
              <p className="text-[var(--text-muted)]">{t("idleHint")}</p>
            ) : feedback.kind === "reserved-admin" ? (
              <div className="flex flex-wrap items-center justify-center gap-2 rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] px-3.5 py-2 text-[var(--badge-warn-fg)]">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <WarningCircle size={15} weight="fill" aria-hidden="true" className="shrink-0" />
                  <span>{feedback.text}</span>
                </span>
                <button
                  type="button"
                  onClick={() => openSetupPopup(feedback.payload, true)}
                  className="cursor-pointer rounded-md border border-[var(--badge-warn-border)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-subtle)]"
                >
                  {t("adminOverrideAction")}
                </button>
              </div>
            ) : (
              <>
                <p
                  role="alert"
                  className="inline-flex items-center gap-1.5 font-medium text-[var(--badge-dead-fg)]"
                >
                  <WarningCircle size={15} weight="fill" aria-hidden="true" className="shrink-0" />
                  <span>{feedback.text}</span>
                </p>
                {feedback.suggestions && feedback.suggestions.length > 0 ? (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    <span className="text-[var(--text-muted)]">{t("suggestionsLabel")}</span>
                    {feedback.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => {
                          setLabel(suggestion);
                          setFeedback(null);
                          inputRef.current?.focus();
                        }}
                        className="font-mono-code cursor-pointer rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-subtle)]"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </form>
      </div>

      {/* Lazy-Loaded Native <dialog> Setup Popup */}
      {popupMounted ? (
        <LazySubdomainSetupDialog
          target={popupTarget}
          onClosed={() => setPopupTarget(null)}
          onCreateAnother={() => {
            setPopupTarget(null);
            setLabel("");
            setFeedback(null);
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
      ) : null}
    </section>
  );
}
