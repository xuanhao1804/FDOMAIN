"use client";

import {
  ArrowUpRight,
  Broadcast,
  CaretDown,
  CheckCircle,
  CopySimple,
  Globe,
  HardDrives,
  LockSimpleOpen,
  Plus,
  RocketLaunch,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { AvailabilityStatus } from "@/lib/availability";
import type { DomainCapability } from "@/lib/dns-providers/types";
import {
  buildPreviewDnsRows,
  isValidCnameTarget,
  isValidIpv4,
  type SupportedRecordType,
} from "@/lib/dns-rules";
import { invalidateLiveRecordsCache } from "@/lib/live-records-cache";
import type { SiteRootDomainMeta } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useAdminSession } from "./admin-context";
import { CopyButton } from "./copy-button";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export interface PopupTarget {
  domainMeta: SiteRootDomainMeta;
  label: string;
  fqdn: string;
  availabilityStatus: AvailabilityStatus;
  providerMode: DomainCapability["mode"];
  isReservedOverride: boolean;
}

export interface SubdomainSetupDialogProps {
  target: PopupTarget | null;
  onClosed: () => void;
  onCreateAnother: () => void;
}

type HostPreset = "vercel" | "github-pages" | "netlify" | "vps";

const PRESET_CONFIG: Record<
  HostPreset,
  {
    recordType: SupportedRecordType;
    defaultTarget: string;
    labelKey: "presetVercel" | "presetGithub" | "presetNetlify" | "presetVps";
    hintKey: "presetVercelHint" | "presetGithubHint" | "presetNetlifyHint" | "presetVpsHint";
  }
> = {
  vercel: {
    recordType: "CNAME",
    defaultTarget: "cname.vercel-dns.com",
    labelKey: "presetVercel",
    hintKey: "presetVercelHint",
  },
  "github-pages": {
    recordType: "CNAME",
    defaultTarget: "your-username.github.io",
    labelKey: "presetGithub",
    hintKey: "presetGithubHint",
  },
  netlify: {
    recordType: "CNAME",
    defaultTarget: "your-site.netlify.app",
    labelKey: "presetNetlify",
    hintKey: "presetNetlifyHint",
  },
  vps: {
    recordType: "A",
    defaultTarget: "203.0.113.10",
    labelKey: "presetVps",
    hintKey: "presetVpsHint",
  },
};

export function SubdomainSetupDialog({
  target,
  onClosed,
  onCreateAnother,
}: SubdomainSetupDialogProps) {
  const t = useTranslations("popup");
  const tClaim = useTranslations("claim");
  const tCommon = useTranslations("common");
  const { authenticated, configured, openLoginModal, preloadLoginModal } = useAdminSession();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const destinationInputRef = useRef<HTMLInputElement>(null);

  const [preset, setPreset] = useState<HostPreset>("vercel");
  const [destination, setDestination] = useState(PRESET_CONFIG.vercel.defaultTarget);
  const [destinationBlurred, setDestinationBlurred] = useState(false);
  const [vercelVerify, setVercelVerify] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraTxt, setExtraTxt] = useState("");
  const [confirmReserved, setConfirmReserved] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdSuccess, setCreatedSuccess] = useState(false);

  const [checkingLive, setCheckingLive] = useState(false);
  const [liveStatus, setLiveStatus] = useState<{
    kind: "ready" | "pending" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (target) {
      setPreset("vercel");
      setDestination(PRESET_CONFIG.vercel.defaultTarget);
      setDestinationBlurred(false);
      setVercelVerify("");
      setExtraName("");
      setExtraTxt("");
      setConfirmReserved(false);
      setShowManualFallback(false);
      setAdvancedOpen(false);
      setSubmitAttempted(false);
      setCreating(false);
      setCreateError(null);
      setCreatedSuccess(false);
      setCheckingLive(false);
      setLiveStatus(null);

      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [target]);

  // Progressive fallback for closedby="any" on browsers without native support (e.g. Safari)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    const onDown = (e: PointerEvent) => {
      pressedOutside = isOutside(e);
    };
    const onUp = (e: PointerEvent) => {
      if (pressedOutside && isOutside(e)) {
        dialog.close();
      }
      pressedOutside = false;
    };
    dialog.addEventListener("pointerdown", onDown);
    dialog.addEventListener("pointerup", onUp);
    return () => {
      dialog.removeEventListener("pointerdown", onDown);
      dialog.removeEventListener("pointerup", onUp);
    };
  }, []);

  const recordType = PRESET_CONFIG[preset].recordType;
  const trimmedDest = destination.trim();
  const destValid =
    recordType === "A" ? isValidIpv4(trimmedDest) : isValidCnameTarget(trimmedDest);
  const destError = !trimmedDest
    ? tClaim("errTargetEmpty")
    : !destValid
      ? recordType === "A"
        ? tClaim("errTargetIpv4")
        : tClaim("errTargetCname")
      : null;
  const showDestError = Boolean(destError && (destinationBlurred || submitAttempted));

  const previewRows = useMemo(() => {
    if (!target) return [];
    return buildPreviewDnsRows({
      rootDomain: target.domainMeta.domain,
      dnsProvider: target.domainMeta.dnsProvider,
      label: target.label,
      recordType,
      target: trimmedDest || PRESET_CONFIG[preset].defaultTarget,
      vercelVerify,
      extraName: preset === "vercel" ? undefined : extraName,
      extraTxt: preset === "vercel" ? undefined : extraTxt,
    });
  }, [target, recordType, trimmedDest, preset, vercelVerify, extraName, extraTxt]);

  function handlePresetSelect(next: HostPreset) {
    setPreset(next);
    setDestination(PRESET_CONFIG[next].defaultTarget);
    setDestinationBlurred(false);
    setCreateError(null);
    setLiveStatus(null);
  }

  function closeModal() {
    const dialog = dialogRef.current;
    if (dialog?.open) {
      dialog.close();
    }
  }

  async function handleCreateSubmit(e: FormEvent) {
    e.preventDefault();
    if (!target) return;

    setSubmitAttempted(true);
    setCreateError(null);

    if (destError) {
      destinationInputRef.current?.focus();
      return;
    }

    if (target.isReservedOverride && !confirmReserved) {
      setCreateError(tClaim("errReservedConfirm", { label: target.label }));
      return;
    }

    if (!authenticated) {
      openLoginModal();
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/dns/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootDomain: target.domainMeta.domain,
          label: target.label,
          recordType,
          target: trimmedDest,
          vercelVerify: preset === "vercel" ? vercelVerify.trim() || undefined : undefined,
          extraName: preset !== "vercel" ? extraName.trim() || undefined : undefined,
          extraTxt: preset !== "vercel" ? extraTxt.trim() || undefined : undefined,
          allowReserved: target.isReservedOverride && confirmReserved,
        }),
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        setCreateError(body.error ?? tClaim("errCreateFailed"));
        return;
      }
      invalidateLiveRecordsCache();
      setCreatedSuccess(true);
    } catch {
      setCreateError(tClaim("errCreateNetwork"));
    } finally {
      setCreating(false);
    }
  }

  async function handleCheckLive() {
    if (!target) return;
    setCheckingLive(true);
    setLiveStatus(null);
    try {
      const res = await fetch(
        `/api/dns/lookup?fqdn=${encodeURIComponent(target.fqdn)}&type=${encodeURIComponent(recordType)}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        status?: string;
        answers?: Array<{ data: string }>;
        error?: string;
      };
      if (!res.ok) {
        setLiveStatus({ kind: "error", text: body.error ?? t("liveErrorResult") });
        return;
      }
      if (body.answers && body.answers.length > 0) {
        setLiveStatus({
          kind: "ready",
          text: t("liveReadyResult", { answers: body.answers.map((a) => a.data).join(", ") }),
        });
      } else {
        setLiveStatus({ kind: "pending", text: t("livePendingResult") });
      }
    } catch {
      setLiveStatus({ kind: "error", text: t("liveErrorResult") });
    } finally {
      setCheckingLive(false);
    }
  }

  const isAutoReady = target?.providerMode === "auto-ready" && configured;
  const isManualFlow = !isAutoReady || showManualFallback;
  const missingServerEnv =
    target !== null &&
    target.domainMeta.dnsProvider !== "namecheap-manual" &&
    (!configured || target.providerMode === "auto-needs-env");

  return (
    <dialog
      ref={dialogRef}
      id="subdomain-setup-dialog"
      aria-labelledby="setup-dialog-title"
      className="editorial-modal editorial-modal-wide"
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = "";
        onClosed();
      }}
    >
      {target ? (
        createdSuccess ? (
          /* State 2: Calm Success View */
          <div className="space-y-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--badge-live-border)] bg-[var(--badge-live-bg)] text-[var(--badge-live-fg)]">
                  <CheckCircle size={22} weight="fill" aria-hidden="true" />
                </span>
                <div>
                  <h2
                    id="setup-dialog-title"
                    className="font-editorial text-xl font-semibold text-[var(--text-primary)]"
                  >
                    {t("successTitle")}
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{t("successSubtitle")}</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label={t("closeAria")}
                onClick={closeModal}
              >
                <X size={16} weight="bold" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-paper)] px-4 py-3.5">
              <a
                href={`https://${target.fqdn}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono-code inline-flex min-w-0 items-center gap-1.5 truncate text-sm font-bold text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--accent-terracotta)]"
              >
                <span className="truncate">https://{target.fqdn}</span>
                <ArrowUpRight size={14} weight="bold" aria-hidden="true" className="shrink-0" />
              </a>
              <CopyButton
                value={`https://${target.fqdn}`}
                label={tCommon("copyLink")}
                text={tCommon("copyLink")}
                showText
              />
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void handleCheckLive()}
                disabled={checkingLive}
                className="w-full"
              >
                <Broadcast size={15} weight="duotone" aria-hidden="true" />
                <span>{checkingLive ? t("checkingLiveAction") : t("checkLiveAction")}</span>
              </Button>
              <div className="min-h-[1.5rem]">
                {liveStatus ? (
                  <p
                    role="status"
                    className={cn(
                      "text-xs font-medium",
                      liveStatus.kind === "ready"
                        ? "text-[var(--badge-live-fg)]"
                        : liveStatus.kind === "error"
                          ? "text-[var(--badge-dead-fg)]"
                          : "text-[var(--badge-warn-fg)]",
                    )}
                  >
                    {liveStatus.text}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--border-color)] pt-4">
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/directory?domain=${encodeURIComponent(target.domainMeta.domain)}`}
                  onClick={closeModal}
                >
                  {t("viewInDirectory")}
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  closeModal();
                  onCreateAnother();
                }}
              >
                <Plus size={14} weight="bold" aria-hidden="true" />
                <span>{t("createAnother")}</span>
              </Button>
            </div>
          </div>
        ) : (
          /* State 1: Calm Single-Column Setup Form */
          <div>
            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-paper)] px-5 py-4">
              <div className="flex min-w-0 items-center gap-2.5">
                {target.isReservedOverride ? (
                  <WarningCircle
                    size={20}
                    weight="fill"
                    aria-hidden="true"
                    className="shrink-0 text-[var(--badge-warn-fg)]"
                  />
                ) : (
                  <CheckCircle
                    size={20}
                    weight="fill"
                    aria-hidden="true"
                    className="shrink-0 text-[var(--badge-live-fg)]"
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2
                      id="setup-dialog-title"
                      className="font-mono-code truncate text-sm font-bold text-[var(--text-primary)]"
                    >
                      {target.fqdn}
                    </h2>
                    <Badge
                      variant={
                        target.isReservedOverride || target.availabilityStatus === "unverified"
                          ? "warn"
                          : "live"
                      }
                    >
                      {target.isReservedOverride
                        ? t("reservedBadge")
                        : target.availabilityStatus === "unverified"
                          ? t("unverifiedBadge")
                          : t("availableBadge")}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                aria-label={t("closeAria")}
                onClick={closeModal}
                className="shrink-0"
              >
                <X size={16} weight="bold" aria-hidden="true" />
              </Button>
            </div>

            <form onSubmit={handleCreateSubmit} noValidate className="space-y-5 p-5">
              {target.availabilityStatus === "unverified" ? (
                <p className="rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] px-3.5 py-2.5 text-xs text-[var(--badge-warn-fg)]">
                  {t("unverifiedNote")}
                </p>
              ) : null}

              {target.isReservedOverride ? (
                <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] p-3 text-xs font-medium text-[var(--badge-warn-fg)]">
                  <input
                    type="checkbox"
                    checked={confirmReserved}
                    onChange={(e) => setConfirmReserved(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span>
                    {t("reservedConfirmText", {
                      label: target.label,
                      domain: target.domainMeta.domain,
                    })}
                  </span>
                </label>
              ) : null}

              {/* Step 1: Hosting Platform */}
              <fieldset className="space-y-2.5">
                <legend className="text-xs font-semibold text-[var(--text-primary)]">
                  {t("stepHostTitle")}
                </legend>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(PRESET_CONFIG) as HostPreset[]).map((key) => {
                    const active = preset === key;
                    const cfg = PRESET_CONFIG[key];
                    return (
                      <label
                        key={key}
                        className={cn(
                          "choice-card flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                          active
                            ? "border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]"
                            : "border-[var(--border-color)] bg-[var(--bg-paper)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]",
                        )}
                      >
                        <input
                          type="radio"
                          name="popupHostPreset"
                          value={key}
                          checked={active}
                          onChange={() => handlePresetSelect(key)}
                          className="sr-radio"
                        />
                        {key === "vps" ? (
                          <HardDrives size={15} weight="duotone" aria-hidden="true" />
                        ) : key === "vercel" ? (
                          <RocketLaunch size={15} weight="duotone" aria-hidden="true" />
                        ) : (
                          <Globe size={15} weight="duotone" aria-hidden="true" />
                        )}
                        <span className="truncate">{t(cfg.labelKey)}</span>
                      </label>
                    );
                  })}
                </div>
                <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                  {t(PRESET_CONFIG[preset].hintKey)}
                </p>
              </fieldset>

              {/* Step 2: Destination Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="popup-destination-input"
                  className="block text-xs font-semibold text-[var(--text-primary)]"
                >
                  {recordType === "A" ? t("destinationIpLabel") : t("destinationLabel")}
                </label>
                <input
                  ref={destinationInputRef}
                  id="popup-destination-input"
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => {
                    setDestination(e.target.value);
                    setCreateError(null);
                  }}
                  onBlur={() => setDestinationBlurred(true)}
                  aria-invalid={showDestError ? "true" : "false"}
                  aria-describedby={showDestError ? "popup-destination-error" : undefined}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  className={cn(
                    "font-mono-code min-h-10 w-full rounded-lg border bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] transition-colors focus-visible:border-[var(--focus-ring)] sm:text-sm",
                    showDestError
                      ? "border-[var(--badge-dead-fg)]"
                      : "border-[var(--border-color)] hover:border-[var(--border-strong)]",
                  )}
                />
                {showDestError && destError ? (
                  <p
                    id="popup-destination-error"
                    className="text-xs font-medium text-[var(--badge-dead-fg)]"
                  >
                    {tCommon("errorPrefix")} {destError}
                  </p>
                ) : null}
              </div>

              {/* Manual 2-Step Copy Guide (for Namecheap, missing env, or manual fallback) */}
              {isManualFlow ? (
                <div className="space-y-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-paper)] p-4">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-primary)]">
                    <CopySimple
                      size={15}
                      weight="duotone"
                      aria-hidden="true"
                      className="text-[var(--accent-terracotta)]"
                    />
                    <span>
                      {t("manualGuideTitle", { registrar: target.domainMeta.registrar })}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-muted)]">{t("manualStep1")}</p>

                  <ul role="list" className="space-y-2">
                    {previewRows.map((row) => (
                      <li
                        key={row.id}
                        className="space-y-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] p-3"
                      >
                        <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
                          <span>
                            {t("typeFieldLabel")}:{" "}
                            <span className="font-mono-code text-[var(--text-primary)]">
                              {row.type}
                            </span>
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-paper)] px-2.5 py-1.5">
                            <div className="min-w-0">
                              <span className="block text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                                {t("hostFieldLabel")}
                              </span>
                              <code className="font-mono-code block truncate text-xs font-semibold text-[var(--text-primary)]">
                                {row.host}
                              </code>
                            </div>
                            <CopyButton value={row.host} label={t("hostFieldLabel")} />
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-paper)] px-2.5 py-1.5">
                            <div className="min-w-0">
                              <span className="block text-[10px] font-semibold uppercase text-[var(--text-muted)]">
                                {t("valueFieldLabel")}
                              </span>
                              <code className="font-mono-code block truncate text-xs font-semibold text-[var(--text-primary)]">
                                {row.value}
                              </code>
                            </div>
                            <CopyButton value={row.value} label={t("valueFieldLabel")} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    {target.domainMeta.dnsProvider === "namecheap-manual"
                      ? t("manualStep2Namecheap")
                      : t("manualStep2Generic", { registrar: target.domainMeta.registrar })}
                  </p>

                  {missingServerEnv ? (
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {t("envMissingHint")}{" "}
                      <Link
                        href="/health"
                        onClick={closeModal}
                        className="font-semibold text-[var(--text-primary)] underline underline-offset-4 hover:text-[var(--accent-terracotta)]"
                      >
                        {t("openSystemLink")} →
                      </Link>
                    </p>
                  ) : null}

                  <div className="space-y-1.5 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void handleCheckLive()}
                      disabled={checkingLive}
                      className="w-full"
                    >
                      <Broadcast size={15} weight="duotone" aria-hidden="true" />
                      <span>{checkingLive ? t("checkingLiveAction") : t("checkLiveAction")}</span>
                    </Button>
                    {liveStatus ? (
                      <p
                        role="status"
                        className={cn(
                          "text-xs font-medium",
                          liveStatus.kind === "ready"
                            ? "text-[var(--badge-live-fg)]"
                            : liveStatus.kind === "error"
                              ? "text-[var(--badge-dead-fg)]"
                              : "text-[var(--badge-warn-fg)]",
                        )}
                      >
                        {liveStatus.text}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Collapsed Advanced Disclosure (tucked away for non-coders) */}
              <details
                className="editorial-accordion rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] px-3.5 py-2.5"
                onToggle={(e) => setAdvancedOpen((e.currentTarget as HTMLDetailsElement).open)}
              >
                <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                  <span>{t("advancedToggle")}</span>
                  <CaretDown
                    size={14}
                    weight="bold"
                    aria-hidden="true"
                    className={cn("transition-transform", advancedOpen && "rotate-180")}
                  />
                </summary>

                <div className="mt-3 space-y-3 border-t border-[var(--border-color)] pt-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="popup-verify-input"
                      className="block text-[11px] font-semibold text-[var(--text-muted)]"
                    >
                      {preset === "vercel" ? t("verifyVercelLabel") : t("verifyExtraLabel")}
                    </label>
                    <input
                      id="popup-verify-input"
                      type="text"
                      value={preset === "vercel" ? vercelVerify : extraTxt}
                      onChange={(e) =>
                        preset === "vercel"
                          ? setVercelVerify(e.target.value)
                          : setExtraTxt(e.target.value)
                      }
                      placeholder={
                        preset === "vercel"
                          ? `vc-domain-verify=${target.fqdn},...`
                          : t("verifyExtraPlaceholder")
                      }
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="font-mono-code min-h-9 w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                    />
                    {preset === "vercel" ? (
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {t("verifyVercelHint", { domain: target.domainMeta.domain })}
                      </p>
                    ) : (
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
                        <span>{t("verifyExtraPrefixLabel")}</span>
                        <input
                          aria-label={t("verifyExtraPrefixAria")}
                          type="text"
                          value={extraName}
                          onChange={(e) => setExtraName(e.target.value)}
                          placeholder="_acme-challenge"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          className="font-mono-code w-36 rounded border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                        />
                      </div>
                    )}
                  </div>

                  {!isManualFlow ? (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-[var(--text-muted)]">
                        {t("previewTableLabel")}
                      </p>
                      <ul role="list" className="space-y-1.5">
                        {previewRows.map((row) => (
                          <li
                            key={row.id}
                            className="font-mono-code flex items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-secondary)]"
                          >
                            <span className="truncate">
                              <strong className="text-[var(--text-primary)]">{row.type}</strong>{" "}
                              {row.host} → {row.value}
                            </span>
                            <CopyButton value={row.value} label={t("valueFieldLabel")} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="pt-0.5">
                    <Link
                      href={`/claim?domain=${encodeURIComponent(target.domainMeta.domain)}&label=${encodeURIComponent(target.label)}`}
                      onClick={closeModal}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text-primary)]"
                    >
                      <span>{t("openFullBuilder")}</span>
                      <ArrowUpRight size={13} weight="bold" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </details>

              {/* Inline API Error */}
              {createError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-[var(--badge-dead-border)] bg-[var(--badge-dead-bg)] p-3 text-xs font-medium text-[var(--badge-dead-fg)]"
                >
                  <WarningCircle size={15} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
                  <span className="break-words">{createError}</span>
                </div>
              ) : null}

              {/* Primary Action Area (for Auto-Ready domains) */}
              {isAutoReady && !showManualFallback ? (
                <div className="space-y-2.5 border-t border-[var(--border-color)] pt-4">
                  {authenticated ? (
                    <Button type="submit" size="lg" disabled={creating} className="w-full">
                      <Plus size={15} weight="bold" aria-hidden="true" />
                      <span>{creating ? t("creatingAction") : t("createNowAction")}</span>
                    </Button>
                  ) : (
                    <>
                      <p className="text-xs text-[var(--text-muted)]">
                        {t("unlockNote", { domain: target.domainMeta.domain })}
                      </p>
                      <Button
                        type="button"
                        size="lg"
                        onMouseEnter={preloadLoginModal}
                        onFocus={preloadLoginModal}
                        onClick={openLoginModal}
                        className="w-full"
                      >
                        <LockSimpleOpen size={15} weight="bold" aria-hidden="true" />
                        <span>{t("unlockAndCreateAction")}</span>
                      </Button>
                      <button
                        type="button"
                        onClick={() => setShowManualFallback(true)}
                        className="w-full cursor-pointer py-1 text-center text-xs font-medium text-[var(--text-muted)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text-primary)]"
                      >
                        {t("showManualCopyAction")}
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </form>
          </div>
        )
      ) : null}
    </dialog>
  );
}
