"use client";

import {
  ArrowUpRight,
  Broadcast,
  CaretDown,
  CheckCircle,
  CloudCheck,
  Code,
  CopySimple,
  Globe,
  HardDrives,
  LockSimpleOpen,
  Plus,
  RocketLaunch,
  WarningCircle,
} from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import {
  buildPreviewDnsRows,
  isReservedSubdomainLabel,
  isValidCnameTarget,
  isValidIpv4,
  isValidSubdomainLabel,
  matchesUnmanagedRule,
  type SupportedRecordType,
} from "@/lib/dns-rules";
import { invalidateLiveRecordsCache } from "@/lib/live-records-cache";
import type { SiteRootDomainMeta, SiteUnmanagedRule } from "@/lib/registry";
import { cn } from "@/lib/utils";
import { useAdminSession } from "./admin-context";
import { CopyButton } from "./copy-button";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Skeleton } from "./ui/skeleton";

const importGitOpsPanel = () =>
  import("./gitops-pr-panel").then((mod) => mod.GitOpsPrPanel);

const LazyGitOpsPrPanel = dynamic(importGitOpsPanel, {
  ssr: false,
  loading: () => (
    <div className="mt-4 space-y-3 border-t border-[var(--border-color)] pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <Skeleton className="h-28 w-full rounded-lg" />
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  ),
});

interface ClaimBuilderProps {
  rootDomains: SiteRootDomainMeta[];
  initialDomain: string;
  initialLabel?: string;
  defaultRootDomain: string;
  repository: string;
  reservedLabels: string[];
  unmanaged: SiteUnmanagedRule[];
}

type HostPreset = "vercel" | "github-pages" | "netlify" | "vps";
type PresetHintKey = "presetVercelHint" | "presetGithubHint" | "presetNetlifyHint" | "presetVpsHint";

const HARD_LOCKED_TYPES = new Set(["MX", "NS", "SOA", "SRV", "PTR", "CAA"]);

const PRESET_DEFAULTS: Record<
  HostPreset,
  {
    labelKey: "presetVercel" | "presetGithub" | "presetNetlify" | "presetVps";
    recordType: SupportedRecordType;
    target: string;
    hintKey: PresetHintKey;
  }
> = {
  vercel: {
    labelKey: "presetVercel",
    recordType: "CNAME",
    target: "cname.vercel-dns.com",
    hintKey: "presetVercelHint",
  },
  "github-pages": {
    labelKey: "presetGithub",
    recordType: "CNAME",
    target: "your-username.github.io",
    hintKey: "presetGithubHint",
  },
  netlify: {
    labelKey: "presetNetlify",
    recordType: "CNAME",
    target: "your-site.netlify.app",
    hintKey: "presetNetlifyHint",
  },
  vps: {
    labelKey: "presetVps",
    recordType: "A",
    target: "203.0.113.10",
    hintKey: "presetVpsHint",
  },
};

export function ClaimBuilder({
  rootDomains,
  initialDomain,
  initialLabel = "",
  defaultRootDomain,
  repository,
  reservedLabels,
  unmanaged,
}: ClaimBuilderProps) {
  const t = useTranslations("claim");
  const tPopup = useTranslations("popup");
  const tDomains = useTranslations("domains");
  const tCommon = useTranslations("common");
  const { authenticated, configured, capabilities, openLoginModal, preloadLoginModal } =
    useAdminSession();

  const [selectedDomain, setSelectedDomain] = useState(initialDomain);
  const [subdomainLabel, setSubdomainLabel] = useState(initialLabel || "my-app");
  const [labelBlurred, setLabelBlurred] = useState(false);

  const [preset, setPreset] = useState<HostPreset>("vercel");
  const [target, setTarget] = useState("cname.vercel-dns.com");
  const [targetBlurred, setTargetBlurred] = useState(false);

  const [githubUser, setGithubUser] = useState("");
  const [description, setDescription] = useState("My website on Vercel");
  const [vercelVerify, setVercelVerify] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraTxt, setExtraTxt] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [allowReserved, setAllowReserved] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [gitOpsOpen, setGitOpsOpen] = useState(false);

  const [applying, setApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const [verifyingDoh, setVerifyingDoh] = useState(false);
  const [dohResult, setDohResult] = useState<{
    status: string;
    answers: Array<{ data: string; ttl: number }>;
    error?: string;
  } | null>(null);

  const labelInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const preloadGitOpsPanel = useCallback(() => {
    void importGitOpsPanel();
  }, []);

  const activeDomainMeta =
    rootDomains.find((d) => d.domain.toLowerCase() === selectedDomain.toLowerCase()) ??
    rootDomains[0]!;
  const capability = capabilities.find(
    (c) => c.domain.toLowerCase() === activeDomainMeta.domain.toLowerCase(),
  );
  const isAutoReady = capability?.mode === "auto-ready";
  const isManualOnly = activeDomainMeta.dnsProvider === "namecheap-manual";
  const recordType = PRESET_DEFAULTS[preset].recordType;

  // Fixed width computed from longest configured root domain + leading dot + padding
  const maxSuffixChars = useMemo(
    () => Math.max(...rootDomains.map((d) => d.domain.length), 14) + 1,
    [rootDomains],
  );

  function localizedDomainNote(dom: SiteRootDomainMeta, mode?: string): string {
    if (dom.dnsProvider === "namecheap-manual") {
      return tDomains("noteNamecheap");
    }
    if (mode === "auto-ready") {
      return tDomains("noteAutoReady");
    }
    return tDomains("noteAutoNeedsEnv", { registrar: dom.registrar });
  }

  function getHardLockMessage(hostLabel: string, type: string, value: string): string | null {
    const clean = hostLabel.trim().toLowerCase() || "@";
    const upperType = type.trim().toUpperCase();
    if (clean === "@") return t("errHardLockApex");
    if (HARD_LOCKED_TYPES.has(upperType)) return t("errHardLockType", { type: upperType });
    for (const rule of unmanaged) {
      if (matchesUnmanagedRule(clean, upperType, value, rule)) {
        return t("errHardLockUnmanaged", { label: rule.label });
      }
    }
    return null;
  }

  function handlePresetChange(next: HostPreset) {
    setPreset(next);
    const meta = PRESET_DEFAULTS[next];
    if (next === "github-pages" && githubUser.trim()) {
      setTarget(`${githubUser.trim().toLowerCase()}.github.io`);
    } else {
      setTarget(meta.target);
    }
    setDescription(t("defaultProjectDesc", { preset: tPopup(meta.labelKey) }));
    setTargetBlurred(false);
    setApplyFeedback(null);
    setDohResult(null);
  }

  const trimmedLabel = subdomainLabel.trim().toLowerCase();
  const hardLockReason = trimmedLabel
    ? getHardLockMessage(trimmedLabel, recordType, target.trim())
    : null;
  const labelInvalidFormat = trimmedLabel.length > 0 && !isValidSubdomainLabel(trimmedLabel);
  const labelEmpty = trimmedLabel.length === 0;
  const labelError = labelEmpty
    ? t("errLabelEmpty")
    : labelInvalidFormat
      ? t("errLabelInvalid")
      : hardLockReason;

  const trimmedTarget = target.trim();
  const targetValid =
    recordType === "A" ? isValidIpv4(trimmedTarget) : isValidCnameTarget(trimmedTarget);
  const targetError = !trimmedTarget
    ? t("errTargetEmpty")
    : !targetValid
      ? recordType === "A"
        ? t("errTargetIpv4")
        : t("errTargetCname")
      : null;

  const showLabelError = Boolean(labelError && (labelBlurred || submitAttempted));
  const showTargetError = Boolean(targetError && (targetBlurred || submitAttempted));

  const cleanLabel = isValidSubdomainLabel(trimmedLabel) ? trimmedLabel : "my-app";
  const fqdn = `${cleanLabel}.${activeDomainMeta.domain}`;
  const isReservedOnly =
    !hardLockReason && isReservedSubdomainLabel(cleanLabel, reservedLabels);

  const previewRows = useMemo(
    () =>
      buildPreviewDnsRows({
        rootDomain: activeDomainMeta.domain,
        dnsProvider: activeDomainMeta.dnsProvider,
        label: cleanLabel,
        recordType,
        target: trimmedTarget || PRESET_DEFAULTS[preset].target,
        vercelVerify,
        extraName: preset === "vercel" ? undefined : extraName,
        extraTxt: preset === "vercel" ? undefined : extraTxt,
      }),
    [
      activeDomainMeta.domain,
      activeDomainMeta.dnsProvider,
      cleanLabel,
      recordType,
      trimmedTarget,
      preset,
      vercelVerify,
      extraName,
      extraTxt,
    ],
  );

  const copyAllSummary = previewRows
    .map((r) => `Host: ${r.host} | Type: ${r.type} | Value: ${r.value} | TTL: ${r.ttl}`)
    .join("\n");

  const cleanTarget = trimmedTarget || PRESET_DEFAULTS[preset].target;

  async function handleCreateLiveDns(e: FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setApplyFeedback(null);

    if (labelError) {
      labelInputRef.current?.focus();
      return;
    }
    if (targetError) {
      targetInputRef.current?.focus();
      return;
    }
    if (isReservedOnly && !allowReserved) {
      setApplyFeedback({
        kind: "error",
        text: t("errReservedConfirm", { label: cleanLabel }),
      });
      return;
    }

    if (!authenticated) {
      openLoginModal();
      return;
    }

    setApplying(true);
    try {
      const res = await fetch("/api/dns/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rootDomain: activeDomainMeta.domain,
          label: cleanLabel,
          recordType,
          target: cleanTarget,
          vercelVerify: preset === "vercel" ? vercelVerify.trim() || undefined : undefined,
          extraName: preset !== "vercel" ? extraName.trim() || undefined : undefined,
          extraTxt: preset !== "vercel" ? extraTxt.trim() || undefined : undefined,
          allowReserved,
        }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        error?: string;
        created?: Array<{ fqdn: string; type: string; value: string }>;
      };
      if (!res.ok) {
        setApplyFeedback({
          kind: "error",
          text: body.error ?? t("errCreateFailed"),
        });
        return;
      }
      const createdList = body.created?.map((c) => `${c.fqdn} → ${c.value}`).join("; ");
      invalidateLiveRecordsCache();
      setApplyFeedback({
        kind: "success",
        text: createdList
          ? t("createdLiveSuccess", {
              registrar: activeDomainMeta.registrar,
              records: createdList,
            })
          : t("createdSimpleSuccess", { fqdn }),
      });
    } catch {
      setApplyFeedback({
        kind: "error",
        text: t("errCreateNetwork"),
      });
    } finally {
      setApplying(false);
    }
  }

  async function handleVerifyDoh() {
    setVerifyingDoh(true);
    setDohResult(null);
    try {
      const res = await fetch(
        `/api/dns/lookup?fqdn=${encodeURIComponent(fqdn)}&type=${encodeURIComponent(recordType)}`,
        { cache: "no-store" },
      );
      const body = (await res.json()) as {
        status?: string;
        answers?: Array<{ data: string; ttl: number }>;
        error?: string;
      };
      if (!res.ok) {
        setDohResult({
          status: "error",
          answers: [],
          error: body.error ?? t("dohLookupError"),
        });
        return;
      }
      setDohResult({
        status: body.status ?? "empty",
        answers: body.answers ?? [],
      });
    } catch {
      setDohResult({
        status: "error",
        answers: [],
        error: t("dohNetworkError"),
      });
    } finally {
      setVerifyingDoh(false);
    }
  }

  function localizedRowPurpose(id: string, fallback: string): string {
    if (id === "primary") return t("purposePrimary");
    if (id === "vercel-verify") return t("purposeVercel");
    if (id === "extra-challenge") return t("purposeChallenge");
    return fallback;
  }

  return (
    <div className="reveal-block space-y-6">
      <div className="space-y-1">
        <h1 className="font-editorial text-2xl font-semibold text-[var(--text-primary)] sm:text-3xl">
          {t("title")}
        </h1>
        <p className="text-sm text-[var(--text-muted)]">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        {/* Left: Calm, Non-Technical Friendly Builder Form */}
        <form
          onSubmit={handleCreateLiveDns}
          noValidate
          aria-labelledby="builder-form-title"
          className="bento-card isolated-card min-w-0 space-y-5 p-6"
        >
          <h2 id="builder-form-title" className="text-base font-semibold text-[var(--text-primary)]">
            {t("step1Title")}
          </h2>

          {/* Friendly Root Domain Selector */}
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="text-xs font-semibold text-[var(--text-secondary)]">
              {t("availableDomainsLegend", { count: rootDomains.length })}
            </legend>
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
              {rootDomains.map((dom) => {
                const selected =
                  dom.domain.toLowerCase() === activeDomainMeta.domain.toLowerCase();
                const cap = capabilities.find(
                  (c) => c.domain.toLowerCase() === dom.domain.toLowerCase(),
                );
                const isDomAuto = cap?.mode === "auto-ready";
                const inputId = `domain-choice-${dom.domain}`;

                return (
                  <label
                    key={dom.domain}
                    htmlFor={inputId}
                    className={cn(
                      "choice-card flex min-w-0 cursor-pointer flex-col justify-between gap-2.5 rounded-xl border p-4 transition-colors",
                      selected
                        ? "border-[var(--text-primary)] bg-[var(--bg-paper)]"
                        : "border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]",
                    )}
                  >
                    <input
                      id={inputId}
                      type="radio"
                      name="selectedRootDomain"
                      value={dom.domain}
                      checked={selected}
                      onChange={() => {
                        setSelectedDomain(dom.domain);
                        setAllowReserved(false);
                        setApplyFeedback(null);
                        setDohResult(null);
                      }}
                      className="sr-radio"
                    />
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono-code block truncate text-sm font-bold text-[var(--text-primary)]">
                          .{dom.domain}
                        </span>
                        {isDomAuto ? (
                          <CloudCheck
                            size={16}
                            weight="duotone"
                            aria-hidden="true"
                            className="shrink-0 text-[var(--badge-live-fg)]"
                          />
                        ) : (
                          <CopySimple
                            size={16}
                            weight="duotone"
                            aria-hidden="true"
                            className="shrink-0 text-[var(--badge-warn-fg)]"
                          />
                        )}
                      </div>
                      <Badge variant={isDomAuto ? "live" : "warn"} className="min-w-[7.25rem] justify-center">
                        {isDomAuto ? tDomains("modeAuto") : tDomains("modeCopy")}
                      </Badge>
                    </div>
                    <span className="min-h-[2.25rem] text-xs leading-relaxed text-[var(--text-muted)]">
                      {localizedDomainNote(dom, cap?.mode)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Subdomain Input + Fixed-Width Suffix */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="claim-label"
              className="text-xs font-semibold text-[var(--text-secondary)]"
            >
              {t("subdomainLabel")}
            </label>
            <div
              className={cn(
                "flex min-w-0 items-center overflow-hidden rounded-lg border bg-[var(--bg-surface)] transition-colors focus-within:border-[var(--focus-ring)]",
                showLabelError ? "border-[var(--badge-dead-fg)]" : "border-[var(--border-color)]",
              )}
            >
              <input
                ref={labelInputRef}
                id="claim-label"
                name="subdomainLabel"
                type="text"
                required
                value={subdomainLabel}
                onChange={(e) => {
                  setSubdomainLabel(e.target.value);
                  setApplyFeedback(null);
                  setDohResult(null);
                }}
                onBlur={() => setLabelBlurred(true)}
                aria-invalid={showLabelError ? "true" : "false"}
                aria-describedby={
                  showLabelError ? "claim-label-hint claim-label-error" : "claim-label-hint"
                }
                placeholder={t("subdomainPlaceholder")}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="editorial-input font-mono-code min-h-10 min-w-0 w-full flex-1 bg-transparent px-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none sm:text-sm"
              />
              <span
                className="font-mono-code shrink-0 truncate border-l border-[var(--border-color)] bg-[var(--bg-paper)] px-3 py-2.5 text-center text-xs font-semibold text-[var(--text-secondary)]"
                style={{
                  width: `min(48%, calc(${maxSuffixChars}ch + 2rem))`,
                }}
              >
                .{activeDomainMeta.domain}
              </span>
            </div>

            <div className="min-h-[1.5rem] text-xs leading-snug">
              {showLabelError && labelError ? (
                <p id="claim-label-error" className="font-medium text-[var(--badge-dead-fg)]">
                  {tCommon("errorPrefix")} {labelError}
                </p>
              ) : (
                <p id="claim-label-hint" className="text-[var(--text-muted)]">
                  {t("subdomainHint")}
                </p>
              )}
            </div>
          </div>

          {isReservedOnly ? (
            <div className="rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] p-3 text-xs text-[var(--badge-warn-fg)]">
              <label className="flex cursor-pointer items-start gap-2.5 font-medium">
                <input
                  type="checkbox"
                  checked={allowReserved}
                  onChange={(e) => setAllowReserved(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  {t("reservedCheckboxText", {
                    label: cleanLabel,
                    domain: activeDomainMeta.domain,
                  })}
                </span>
              </label>
            </div>
          ) : null}

          {/* Friendly Hosting Platform Selector */}
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="text-xs font-semibold text-[var(--text-secondary)]">
              {t("presetLegend")}
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(PRESET_DEFAULTS) as HostPreset[]).map((key) => {
                const active = preset === key;
                const radioId = `preset-${key}`;
                return (
                  <label
                    key={key}
                    htmlFor={radioId}
                    className={cn(
                      "choice-card inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors",
                      active
                        ? "border-[var(--btn-primary-bg)] bg-[var(--btn-primary-bg)] text-[var(--btn-primary-fg)]"
                        : "border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]",
                    )}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="hostPreset"
                      value={key}
                      checked={active}
                      onChange={() => handlePresetChange(key)}
                      className="sr-radio"
                    />
                    {key === "vps" ? (
                      <HardDrives size={14} weight="duotone" aria-hidden="true" />
                    ) : key === "vercel" ? (
                      <RocketLaunch size={14} weight="duotone" aria-hidden="true" />
                    ) : (
                      <Globe size={14} weight="duotone" aria-hidden="true" />
                    )}
                    <span className="truncate">{tPopup(PRESET_DEFAULTS[key].labelKey)}</span>
                  </label>
                );
              })}
            </div>
            <p className="min-h-[1.5rem] text-xs text-[var(--text-muted)]">
              {t(PRESET_DEFAULTS[preset].hintKey)}
            </p>
          </fieldset>

          {/* Clean Full-Width Destination Input (no cramped 2-col TXT clutter) */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <label
              htmlFor="claim-target"
              className="text-xs font-semibold text-[var(--text-secondary)]"
            >
              {recordType === "A" ? t("targetIpv4Label") : t("targetCnameLabel")}
            </label>
            <input
              ref={targetInputRef}
              id="claim-target"
              name="target"
              type="text"
              required
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setApplyFeedback(null);
              }}
              onBlur={() => setTargetBlurred(true)}
              aria-invalid={showTargetError ? "true" : "false"}
              aria-describedby={showTargetError ? "claim-target-error" : undefined}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              className={cn(
                "editorial-input font-mono-code min-h-10 min-w-0 w-full rounded-lg border bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] transition-colors focus-visible:border-[var(--focus-ring)] sm:text-sm",
                showTargetError
                  ? "border-[var(--badge-dead-fg)]"
                  : "border-[var(--border-color)] hover:border-[var(--border-strong)]",
              )}
            />
            <div className="min-h-[1.5rem] text-xs leading-snug">
              {showTargetError && targetError ? (
                <p id="claim-target-error" className="font-medium text-[var(--badge-dead-fg)]">
                  {tCommon("errorPrefix")} {targetError}
                </p>
              ) : null}
            </div>
          </div>

          {/* Optional Verification Code — collapsed by default so non-coders stay calm */}
          <details
            className="editorial-accordion rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] px-3.5 py-2.5"
            onToggle={(e) => setVerifyOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
              <span>{t("verifySectionToggle")}</span>
              <CaretDown
                size={14}
                weight="bold"
                aria-hidden="true"
                className={cn("shrink-0 transition-transform", verifyOpen && "rotate-180")}
              />
            </summary>

            <div className="mt-3 space-y-2.5 border-t border-[var(--border-color)] pt-3">
              <label
                htmlFor="claim-verify-value"
                className="block text-xs font-medium text-[var(--text-secondary)]"
              >
                {preset === "vercel" ? t("verifyVercelLabel") : t("verifyExtraLabel")}
              </label>
              <input
                id="claim-verify-value"
                name={preset === "vercel" ? "vercelVerify" : "extraTxt"}
                type="text"
                value={preset === "vercel" ? vercelVerify : extraTxt}
                onChange={(e) =>
                  preset === "vercel"
                    ? setVercelVerify(e.target.value)
                    : setExtraTxt(e.target.value)
                }
                placeholder={
                  preset === "vercel"
                    ? `vc-domain-verify=${fqdn},...`
                    : t("verifyExtraPlaceholder")
                }
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono-code min-h-10 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-base text-[var(--text-primary)] placeholder:text-[var(--text-muted)] transition-colors hover:border-[var(--border-strong)] focus-visible:border-[var(--focus-ring)] sm:text-sm"
              />
              {preset === "vercel" ? (
                <p className="text-[11px] text-[var(--text-muted)]">
                  {t("verifyVercelHint", { domain: activeDomainMeta.domain })}
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
                    className="font-mono-code w-40 rounded border border-[var(--border-color)] bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                  />
                </div>
              )}
            </div>
          </details>

          {/* Action Footer */}
          <div className="space-y-3 border-t border-[var(--border-color)] pt-4">
            <div className="flex min-h-[5.5rem] flex-col justify-between gap-2.5">
              {isManualOnly ? (
                <>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("namecheapFooterLabel", { registrar: activeDomainMeta.registrar })}
                    </strong>{" "}
                    {t("namecheapFooterText", { registrar: activeDomainMeta.registrar })}
                  </p>
                  <div className="flex items-center">
                    <span className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-md border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] px-4 text-xs font-semibold text-[var(--badge-warn-fg)]">
                      <CopySimple size={15} weight="duotone" aria-hidden="true" />
                      <span>{t("manualModeBadge")}</span>
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-[var(--text-muted)]">
                    <strong className="text-[var(--text-primary)]">
                      {t("autoApiFooterLabel", { registrar: activeDomainMeta.registrar })}
                    </strong>{" "}
                    {authenticated && isAutoReady
                      ? t("autoApiUnlockedDesc")
                      : configured && isAutoReady
                        ? t("autoApiLockedDesc")
                        : t("autoApiEnvMissingDesc")}
                  </p>
                  {authenticated ? (
                    <Button
                      type="submit"
                      size="lg"
                      disabled={applying || !isAutoReady}
                      className="w-full"
                    >
                      <Plus size={15} weight="bold" aria-hidden="true" />
                      <span>
                        {applying
                          ? t("creatingDnsAction")
                          : !isAutoReady
                            ? t("providerEnvMissingAction")
                            : t("createDnsAction")}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="lg"
                      onMouseEnter={preloadLoginModal}
                      onFocus={preloadLoginModal}
                      onClick={openLoginModal}
                      className="w-full"
                    >
                      <LockSimpleOpen size={15} weight="bold" aria-hidden="true" />
                      <span>
                        {configured ? t("unlockToApplyAction") : t("viewEnvSetupAction")}
                      </span>
                    </Button>
                  )}
                </>
              )}
            </div>

            <div className="min-h-[3rem]">
              {applyFeedback ? (
                <div
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-3 text-xs font-medium",
                    applyFeedback.kind === "success"
                      ? "border-[var(--badge-live-border)] bg-[var(--badge-live-bg)] text-[var(--badge-live-fg)]"
                      : "border-[var(--badge-dead-border)] bg-[var(--badge-dead-bg)] text-[var(--badge-dead-fg)]",
                  )}
                >
                  {applyFeedback.kind === "success" ? (
                    <CheckCircle size={15} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
                  ) : (
                    <WarningCircle size={15} weight="fill" aria-hidden="true" className="mt-0.5 shrink-0" />
                  )}
                  <span className="break-words">{applyFeedback.text}</span>
                </div>
              ) : null}
            </div>
          </div>
        </form>

        {/* Right: Friendly Live Address Preview + Copyable Connection Details + Optional GitOps */}
        <div className="min-w-0 space-y-4">
          <Card className="isolated-card min-w-0 space-y-5 p-6">
            {/* Friendly Resulting Address Card */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-[var(--text-primary)]">
                  {t("step2Title")}
                </h2>
                <CopyButton value={copyAllSummary} label={t("copyAllAria")} showText />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-paper)] px-4 py-3">
                <div className="min-w-0">
                  <span className="block text-[11px] font-medium text-[var(--text-muted)]">
                    {t("previewHeading")}
                  </span>
                  <a
                    href={`https://${fqdn}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono-code mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-sm font-bold text-[var(--text-primary)] underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--accent-terracotta)]"
                  >
                    <span className="truncate">https://{fqdn}</span>
                    <ArrowUpRight size={13} weight="bold" aria-hidden="true" className="shrink-0" />
                  </a>
                </div>
                <CopyButton value={`https://${fqdn}`} label={tCommon("copyLink")} />
              </div>
            </div>

            {/* Clean Copyable Connection Rows */}
            <ul role="list" className="space-y-3">
              {previewRows.map((row) => (
                <li
                  key={row.id}
                  className="min-w-0 space-y-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      {localizedRowPurpose(row.id, row.purpose)}
                    </span>
                    <Badge variant="info" className="font-mono-code">
                      {row.type}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          {t("hostLabel")}
                        </span>
                        <code className="font-mono-code block truncate text-xs font-semibold text-[var(--text-primary)]">
                          {row.host}
                        </code>
                      </div>
                      <CopyButton
                        value={row.host}
                        label={t("copyHostAria", { host: row.host })}
                      />
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 py-2">
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className="block text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]">
                          {t("valueLabel")}
                        </span>
                        <code className="font-mono-code block truncate text-xs font-semibold text-[var(--text-primary)]">
                          {row.value}
                        </code>
                      </div>
                      <CopyButton
                        value={row.value}
                        label={t("copyValueAria", { value: row.value })}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Plain-Language Live Check */}
            <div className="space-y-2 border-t border-[var(--border-color)] pt-3.5">
              <div className="flex min-w-0 items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyDoh}
                  disabled={verifyingDoh}
                  className="min-w-[9.5rem] shrink-0"
                >
                  <Broadcast size={15} weight="duotone" aria-hidden="true" />
                  <span>{verifyingDoh ? t("checkingDns") : t("verifyLiveDns")}</span>
                </Button>
                <span className="font-mono-code min-w-0 flex-1 truncate text-right text-xs text-[var(--text-muted)]">
                  {fqdn}
                </span>
              </div>

              <div className="min-h-[2rem]">
                {dohResult ? (
                  <p
                    role="status"
                    className={cn(
                      "text-xs font-medium",
                      dohResult.status === "found"
                        ? "text-[var(--badge-live-fg)]"
                        : dohResult.status === "error"
                          ? "text-[var(--badge-dead-fg)]"
                          : "text-[var(--badge-warn-fg)]",
                    )}
                  >
                    {dohResult.error
                      ? dohResult.error
                      : dohResult.answers.length > 0
                        ? t("dohLiveFound", {
                            answers: dohResult.answers.map((a) => a.data).join(", "),
                          })
                        : t("dohNotPropagated")}
                  </p>
                ) : (
                  <p className="text-xs text-[var(--text-muted)]">{t("dohHint")}</p>
                )}
              </div>
            </div>
          </Card>

          {/* Lazy-Loaded Optional GitOps PR Accordion */}
          <details
            className="editorial-accordion bento-card isolated-card min-w-0 p-5"
            onToggle={(e) => setGitOpsOpen((e.currentTarget as HTMLDetailsElement).open)}
          >
            <summary
              onMouseEnter={preloadGitOpsPanel}
              onFocus={preloadGitOpsPanel}
              className="flex cursor-pointer items-center justify-between gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <span className="inline-flex items-center gap-2">
                <Code size={15} weight="duotone" aria-hidden="true" className="text-[var(--text-muted)]" />
                <span>{t("gitopsSummary")}</span>
              </span>
              <CaretDown
                size={14}
                weight="bold"
                aria-hidden="true"
                className={cn("transition-transform", gitOpsOpen && "rotate-180")}
              />
            </summary>

            {gitOpsOpen ? (
              <LazyGitOpsPrPanel
                repository={repository}
                activeDomain={activeDomainMeta.domain}
                defaultRootDomain={defaultRootDomain}
                cleanLabel={cleanLabel}
                fqdn={fqdn}
                recordType={recordType}
                cleanTarget={cleanTarget}
                isVercelPreset={preset === "vercel"}
                vercelVerify={vercelVerify}
                extraName={extraName}
                extraTxt={extraTxt}
                githubUser={githubUser}
                description={description}
                onGithubUserChange={setGithubUser}
                onDescriptionChange={setDescription}
              />
            ) : null}
          </details>
        </div>
      </div>
    </div>
  );
}
