"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import {
  buildPreviewDnsRows,
  isReservedSubdomainLabel,
  isValidCnameTarget,
  isValidIpv4,
  isValidSubdomainLabel,
  matchesUnmanagedRule,
  normalizeExtraPrefix,
  type SupportedRecordType,
} from "@/lib/dns-rules";
import { getLocalizedDomainNote, type MessageKey, type Translator } from "@/lib/i18n/messages";
import type { SiteRootDomainMeta, SiteUnmanagedRule } from "@/lib/registry";
import { useAdminSession } from "./admin-context";
import { CopyButton } from "./copy-button";
import { useI18n } from "./i18n-context";

interface ClaimBuilderProps {
  rootDomains: SiteRootDomainMeta[];
  initialDomain: string;
  defaultRootDomain: string;
  repository: string;
  reservedLabels: string[];
  unmanaged: SiteUnmanagedRule[];
}

type HostPreset = "vercel" | "github-pages" | "netlify" | "vps";

const HARD_LOCKED_TYPES = new Set(["MX", "NS", "SOA", "SRV", "PTR", "CAA"]);

const PRESET_DEFAULTS: Record<
  HostPreset,
  { label: string; recordType: SupportedRecordType; target: string; hintKey: MessageKey }
> = {
  vercel: {
    label: "Vercel",
    recordType: "CNAME",
    target: "cname.vercel-dns.com",
    hintKey: "claim.presetVercelHint",
  },
  "github-pages": {
    label: "GitHub Pages",
    recordType: "CNAME",
    target: "your-username.github.io",
    hintKey: "claim.presetGithubHint",
  },
  netlify: {
    label: "Netlify",
    recordType: "CNAME",
    target: "your-site.netlify.app",
    hintKey: "claim.presetNetlifyHint",
  },
  vps: {
    label: "VPS (IPv4)",
    recordType: "A",
    target: "203.0.113.10",
    hintKey: "claim.presetVpsHint",
  },
};

function getProviderPill(
  t: Translator,
  dom: SiteRootDomainMeta,
  readyState?: string,
): { label: string; isAuto: boolean } {
  if (dom.dnsProvider === "namecheap-manual") {
    return { label: t("domains.providerNamecheapManual"), isAuto: false };
  }
  if (dom.dnsProvider === "namecom") {
    return {
      label:
        readyState === "auto-ready"
          ? t("domains.providerNamecomReady")
          : t("domains.providerNamecomAuto"),
      isAuto: true,
    };
  }
  return {
    label:
      readyState === "auto-ready"
        ? t("domains.providerCloudflareReady")
        : t("domains.providerCloudflareAuto"),
    isAuto: true,
  };
}

function getLocalizedHardLockReason(
  t: Translator,
  hostLabel: string,
  type: string,
  value: string,
  unmanagedRules: SiteUnmanagedRule[],
): string | null {
  const cleanLabel = hostLabel.trim().toLowerCase() || "@";
  const upperType = type.trim().toUpperCase();

  if (cleanLabel === "@") {
    return t("claim.errHardLockApex");
  }
  if (HARD_LOCKED_TYPES.has(upperType)) {
    return t("claim.errHardLockType", { type: upperType });
  }
  for (const rule of unmanagedRules) {
    if (matchesUnmanagedRule(cleanLabel, upperType, value, rule)) {
      return t("claim.errHardLockUnmanaged", { label: rule.label, types: rule.types });
    }
  }
  return null;
}

export function ClaimBuilder({
  rootDomains,
  initialDomain,
  defaultRootDomain,
  repository,
  reservedLabels,
  unmanaged,
}: ClaimBuilderProps) {
  const { t } = useI18n();
  const { authenticated, configured, capabilities, openLoginModal } = useAdminSession();

  const [selectedDomain, setSelectedDomain] = useState(initialDomain);
  const [subdomainLabel, setSubdomainLabel] = useState("my-app");
  const [labelBlurred, setLabelBlurred] = useState(false);

  const [preset, setPreset] = useState<HostPreset>("vercel");
  const [target, setTarget] = useState("cname.vercel-dns.com");
  const [targetBlurred, setTargetBlurred] = useState(false);

  const [githubUser, setGithubUser] = useState("");
  const [description, setDescription] = useState("My project deployed on Vercel");
  const [vercelVerify, setVercelVerify] = useState("");
  const [extraName, setExtraName] = useState("");
  const [extraTxt, setExtraTxt] = useState("");
  const [allowReserved, setAllowReserved] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [applying, setApplying] = useState(false);
  const [applyFeedback, setApplyFeedback] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  const [verifyingDoh, setVerifyingDoh] = useState(false);
  const [dohResult, setDohResult] = useState<{
    status: string;
    resolver?: string;
    answers: Array<{ data: string; ttl: number }>;
    error?: string;
  } | null>(null);

  const labelInputRef = useRef<HTMLInputElement>(null);
  const targetInputRef = useRef<HTMLInputElement>(null);

  const activeDomainMeta =
    rootDomains.find((d) => d.domain.toLowerCase() === selectedDomain.toLowerCase()) ??
    rootDomains[0]!;
  const capability = capabilities.find(
    (c) => c.domain.toLowerCase() === activeDomainMeta.domain.toLowerCase(),
  );
  const isManualOnly = activeDomainMeta.dnsProvider === "namecheap-manual";
  const recordType = PRESET_DEFAULTS[preset].recordType;

  // Fixed width computed from longest configured root domain + leading dot + px-3 padding
  const maxSuffixChars = useMemo(
    () => Math.max(...rootDomains.map((d) => d.domain.length), 14) + 1,
    [rootDomains],
  );

  function handlePresetChange(next: HostPreset) {
    setPreset(next);
    const meta = PRESET_DEFAULTS[next];
    if (next === "github-pages" && githubUser.trim()) {
      setTarget(`${githubUser.trim().toLowerCase()}.github.io`);
    } else {
      setTarget(meta.target);
    }
    setDescription(t("claim.defaultProjectDesc", { preset: meta.label }));
    setTargetBlurred(false);
    setApplyFeedback(null);
    setDohResult(null);
  }

  const trimmedLabel = subdomainLabel.trim().toLowerCase();
  const hardLockReason = trimmedLabel
    ? getLocalizedHardLockReason(t, trimmedLabel, recordType, target.trim(), unmanaged)
    : null;
  const labelInvalidFormat = trimmedLabel.length > 0 && !isValidSubdomainLabel(trimmedLabel);
  const labelEmpty = trimmedLabel.length === 0;
  const labelError = labelEmpty
    ? t("claim.errLabelEmpty")
    : labelInvalidFormat
      ? t("claim.errLabelInvalid")
      : hardLockReason;

  const trimmedTarget = target.trim();
  const targetValid =
    recordType === "A" ? isValidIpv4(trimmedTarget) : isValidCnameTarget(trimmedTarget);
  const targetError = !trimmedTarget
    ? t("claim.errTargetEmpty", { type: recordType })
    : !targetValid
      ? recordType === "A"
        ? t("claim.errTargetIpv4")
        : t("claim.errTargetCname")
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

  const cleanUser = githubUser.trim() || "your-github-username";
  const cleanTarget = trimmedTarget || PRESET_DEFAULTS[preset].target;
  const cleanDesc = description.trim() || `Subdomain ${fqdn}`;
  const gitPayload: Record<string, unknown> = {
    owner: { github: cleanUser },
    description: cleanDesc,
    records: recordType === "A" ? { A: [cleanTarget] } : { CNAME: cleanTarget },
  };
  if (vercelVerify.trim()) {
    gitPayload.vercelVerify = [vercelVerify.trim()];
  }
  const normalizedExtra = extraName ? normalizeExtraPrefix(extraName) : null;
  if (preset !== "vercel" && normalizedExtra && extraTxt.trim()) {
    gitPayload.extra = { [normalizedExtra]: { TXT: [extraTxt.trim()] } };
  }
  const jsonOutput = `${JSON.stringify(gitPayload, null, 2)}\n`;
  const gitRelativePath =
    activeDomainMeta.domain.toLowerCase() === defaultRootDomain.toLowerCase()
      ? `${cleanLabel}.json`
      : `${activeDomainMeta.domain}/${cleanLabel}.json`;
  const githubCreateUrl = `https://github.com/${repository}/new/main/domains?filename=${encodeURIComponent(gitRelativePath)}&value=${encodeURIComponent(jsonOutput)}`;

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
        text: t("claim.errReservedConfirm", { label: cleanLabel }),
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
          text: body.error ?? t("claim.errCreateFailed"),
        });
        return;
      }
      const createdList = body.created?.map((c) => `${c.type} ${c.fqdn} → ${c.value}`).join("; ");
      setApplyFeedback({
        kind: "success",
        text: createdList
          ? t("claim.createdLiveSuccess", {
              registrar: activeDomainMeta.registrar,
              records: createdList,
            })
          : t("claim.createdSimpleSuccess", { fqdn }),
      });
    } catch {
      setApplyFeedback({
        kind: "error",
        text: t("claim.errCreateNetwork"),
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
        resolver?: string;
        answers?: Array<{ data: string; ttl: number }>;
        error?: string;
      };
      if (!res.ok) {
        setDohResult({
          status: "error",
          answers: [],
          error: body.error ?? t("claim.dohLookupError"),
        });
        return;
      }
      setDohResult({
        status: body.status ?? "empty",
        resolver: body.resolver,
        answers: body.answers ?? [],
      });
    } catch {
      setDohResult({
        status: "error",
        answers: [],
        error: t("claim.dohNetworkError"),
      });
    } finally {
      setVerifyingDoh(false);
    }
  }

  function localizedRowPurpose(id: string, fallback: string): string {
    if (id === "primary") return t("claim.purposePrimary");
    if (id === "vercel-verify") return t("claim.purposeVercel");
    if (id === "extra-challenge") return t("claim.purposeChallenge");
    return fallback;
  }

  return (
    <div className="reveal-block space-y-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">
          {t("claim.title")}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
          {t("claim.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
        {/* Left: Form Studio */}
        <form
          onSubmit={handleCreateLiveDns}
          noValidate
          aria-labelledby="builder-form-title"
          className="chibi-panel min-w-0 space-y-5 p-5 sm:p-6"
        >
          <h2 id="builder-form-title" className="font-display text-lg font-extrabold">
            {t("claim.step1Title")}
          </h2>

          {/* Root Domain Selector (consistent structure & fixed card heights) */}
          <fieldset className="min-w-0 space-y-2.5">
            <legend className="text-xs font-bold uppercase tracking-wide">
              {t("claim.availableDomainsLegend", { count: rootDomains.length })}
            </legend>
            <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2">
              {rootDomains.map((dom) => {
                const selected =
                  dom.domain.toLowerCase() === activeDomainMeta.domain.toLowerCase();
                const cap = capabilities.find(
                  (c) => c.domain.toLowerCase() === dom.domain.toLowerCase(),
                );
                const pill = getProviderPill(t, dom, cap?.mode);
                const inputId = `domain-choice-${dom.domain}`;

                return (
                  <label
                    key={dom.domain}
                    htmlFor={inputId}
                    className="choice-card flex min-w-0 cursor-pointer flex-col justify-between gap-2 rounded-2xl border-2 p-3.5 transition-colors"
                    style={{
                      backgroundColor: selected ? "var(--sky-soft)" : "var(--bg-surface)",
                      borderColor: selected ? "#24324a" : "var(--border-color)",
                      boxShadow: selected ? "0 3px 0 #24324a" : "none",
                      color: selected ? "#24324a" : "var(--text-primary)",
                    }}
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
                    <div className="space-y-1.5">
                      <span className="font-mono-code block truncate text-sm font-extrabold">
                        .{dom.domain}
                      </span>
                      <span
                        className="inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
                        style={{
                          backgroundColor: pill.isAuto
                            ? "var(--badge-live-bg)"
                            : "var(--badge-warn-bg)",
                          borderColor: pill.isAuto
                            ? "var(--badge-live-fg)"
                            : "var(--badge-warn-fg)",
                          color: pill.isAuto
                            ? "var(--badge-live-fg)"
                            : "var(--badge-warn-fg)",
                        }}
                      >
                        {pill.label}
                      </span>
                    </div>
                    <span
                      className="line-clamp-2 min-h-[2.25rem] text-xs leading-snug"
                      style={{ color: selected ? "#24324a" : "var(--text-muted)" }}
                    >
                      {getLocalizedDomainNote(t, dom.dnsProvider, dom.registrar, dom.note)}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* Subdomain Input + Fixed-Width Right-Aligned Domain Suffix */}
          <div className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor="claim-label" className="text-xs font-bold uppercase tracking-wide">
              {t("claim.subdomainLabel")}
            </label>
            <div
              className="flex min-w-0 items-center overflow-hidden rounded-xl border-2"
              style={{
                backgroundColor: "var(--bg-surface)",
                borderColor: showLabelError ? "var(--badge-dead-fg)" : "var(--border-color)",
              }}
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
                placeholder={t("claim.subdomainPlaceholder")}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="chibi-input font-mono-code min-h-11 min-w-0 w-full flex-1 bg-transparent px-3 text-base sm:text-sm"
              />
              <span
                className="font-mono-code shrink-0 truncate border-l-2 px-3 py-2.5 text-center text-xs font-bold"
                style={{
                  width: `min(48%, calc(${maxSuffixChars}ch + 2rem))`,
                  backgroundColor: "var(--bg-subtle)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-primary)",
                }}
              >
                .{activeDomainMeta.domain}
              </span>
            </div>
            {/* Single fixed-height helper/error slot (no layout shift on blur/error in vi or en) */}
            <div className="min-h-[2.25rem] sm:min-h-[2.25rem] text-xs leading-snug">
              {showLabelError && labelError ? (
                <p
                  id="claim-label-error"
                  className="font-bold"
                  style={{ color: "var(--badge-dead-fg)" }}
                >
                  {t("common.errorPrefix")} {labelError}
                </p>
              ) : (
                <p id="claim-label-hint" style={{ color: "var(--text-muted)" }}>
                  {t("claim.subdomainHint")}
                </p>
              )}
            </div>
          </div>

          {isReservedOnly ? (
            <div
              className="rounded-2xl border-2 p-3 text-xs"
              style={{
                backgroundColor: "var(--badge-warn-bg)",
                borderColor: "var(--badge-warn-fg)",
                color: "var(--badge-warn-fg)",
              }}
            >
              <label className="flex cursor-pointer items-start gap-2.5 font-bold">
                <input
                  type="checkbox"
                  checked={allowReserved}
                  onChange={(e) => setAllowReserved(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0"
                />
                <span>
                  {t("claim.reservedCheckboxText", {
                    label: cleanLabel,
                    domain: activeDomainMeta.domain,
                  })}
                </span>
              </label>
            </div>
          ) : null}

          {/* Deploy Destination Preset */}
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-xs font-bold uppercase tracking-wide">
              {t("claim.presetLegend")}
            </legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(PRESET_DEFAULTS) as HostPreset[]).map((key) => {
                const active = preset === key;
                const radioId = `preset-${key}`;
                return (
                  <label
                    key={key}
                    htmlFor={radioId}
                    className="choice-card inline-flex min-h-10 cursor-pointer items-center rounded-full border-2 px-4 text-xs font-bold transition-colors"
                    style={{
                      backgroundColor: active ? "var(--sky)" : "var(--bg-surface)",
                      borderColor: "var(--border-color)",
                      color: active ? "#24324a" : "var(--text-primary)",
                      boxShadow: active ? "0 2px 0 var(--border-color)" : "none",
                    }}
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
                    {PRESET_DEFAULTS[key].label}
                  </label>
                );
              })}
            </div>
            <p className="min-h-[2.25rem] sm:min-h-[1.25rem] text-xs" style={{ color: "var(--text-muted)" }}>
              {t(PRESET_DEFAULTS[preset].hintKey)}
            </p>
          </fieldset>

          {/* Uniform 2-Row Grid Across ALL Presets (0 vertical shift when switching preset) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="claim-target" className="text-xs font-bold uppercase tracking-wide">
                {recordType === "A" ? t("claim.targetIpv4Label") : t("claim.targetCnameLabel")}
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
                className="chibi-input font-mono-code min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: showTargetError ? "var(--badge-dead-fg)" : "var(--border-color)",
                }}
              />
              <div className="min-h-[1.75rem] text-xs">
                {showTargetError && targetError ? (
                  <p id="claim-target-error" className="font-bold" style={{ color: "var(--badge-dead-fg)" }}>
                    {t("common.errorPrefix")} {targetError}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 flex-col gap-1.5">
              <label htmlFor="claim-verify-value" className="text-xs font-bold uppercase tracking-wide">
                {preset === "vercel" ? t("claim.verifyVercelLabel") : t("claim.verifyExtraLabel")}
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
                    : t("claim.verifyExtraPlaceholder")
                }
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                className="font-mono-code min-h-11 min-w-0 w-full rounded-xl border-2 px-3 text-base sm:text-sm"
                style={{
                  backgroundColor: "var(--bg-surface)",
                  borderColor: "var(--border-color)",
                }}
              />
              <div className="flex min-h-[1.75rem] items-center text-[11px]" style={{ color: "var(--text-muted)" }}>
                {preset === "vercel" ? (
                  <span className="truncate">
                    {t("claim.verifyVercelHint", { domain: activeDomainMeta.domain })}
                  </span>
                ) : (
                  <span className="inline-flex min-w-0 items-center gap-1.5">
                    <span>{t("claim.verifyExtraPrefixLabel")}</span>
                    <input
                      aria-label={t("claim.verifyExtraPrefixAria")}
                      type="text"
                      value={extraName}
                      onChange={(e) => setExtraName(e.target.value)}
                      placeholder="_acme-challenge"
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="font-mono-code w-36 min-w-0 rounded border px-1.5 py-0.5 text-[11px]"
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        borderColor: "var(--border-color)",
                      }}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stable Footer Slot (identical footprint across Auto & Namecheap domains in both vi and en) */}
          <div className="space-y-3 border-t-2 pt-4" style={{ borderColor: "var(--shadow-tint)" }}>
            <div className="flex min-h-[7.25rem] sm:min-h-[6rem] flex-col justify-between gap-2">
              {isManualOnly ? (
                <>
                  <p className="min-h-[3.75rem] sm:min-h-[2.4rem] text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <strong>{t("claim.namecheapFooterLabel")}</strong>{" "}
                    {t("claim.namecheapFooterText")}
                  </p>
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex min-h-10 flex-1 items-center justify-center rounded-full border-2 px-4 text-xs font-bold"
                      style={{
                        backgroundColor: "var(--badge-warn-bg)",
                        borderColor: "var(--badge-warn-fg)",
                        color: "var(--badge-warn-fg)",
                      }}
                    >
                      {t("claim.manualModeBadge")}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <p className="min-h-[3.75rem] sm:min-h-[2.4rem] text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
                    <strong>
                      {t("claim.autoApiFooterLabel", { registrar: activeDomainMeta.registrar })}
                    </strong>{" "}
                    {authenticated
                      ? t("claim.autoApiUnlockedDesc")
                      : configured
                        ? t("claim.autoApiLockedDesc")
                        : t("claim.autoApiEnvMissingDesc")}
                  </p>
                  {authenticated ? (
                    <button
                      type="submit"
                      disabled={applying || capability?.mode === "auto-needs-env"}
                      className="chibi-cta w-full"
                    >
                      {applying
                        ? t("claim.creatingDnsAction")
                        : capability?.mode === "auto-needs-env"
                          ? t("claim.providerEnvMissingAction")
                          : t("claim.createDnsAction")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openLoginModal}
                      className="chibi-cta w-full"
                    >
                      {configured
                        ? t("claim.unlockToApplyAction")
                        : t("claim.viewEnvSetupAction")}
                    </button>
                  )}
                </>
              )}
            </div>

            {applyFeedback ? (
              <div
                role="status"
                aria-live="polite"
                className="rounded-2xl border-2 p-3 text-xs font-bold"
                style={{
                  backgroundColor:
                    applyFeedback.kind === "success"
                      ? "var(--badge-live-bg)"
                      : "var(--badge-dead-bg)",
                  borderColor:
                    applyFeedback.kind === "success"
                      ? "var(--badge-live-fg)"
                      : "var(--badge-dead-fg)",
                  color:
                    applyFeedback.kind === "success"
                      ? "var(--badge-live-fg)"
                      : "var(--badge-dead-fg)",
                }}
              >
                {applyFeedback.text}
              </div>
            ) : null}
          </div>
        </form>

        {/* Right: Copy-Ready DNS Records + Live Verification + Fixed-Summary Git PR Accordion */}
        <div className="min-w-0 space-y-4">
          <div className="chibi-row-card min-w-0 space-y-4 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-lg font-extrabold">
                  {t("claim.step2Title")}
                </h2>
                <p
                  className="font-mono-code truncate text-xs font-semibold"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("claim.targetFqdnPrefix", { fqdn })}
                </p>
              </div>
              <div className="shrink-0">
                <CopyButton value={copyAllSummary} label={t("claim.copyAllAria")} showText />
              </div>
            </div>

            <ul role="list" className="space-y-3">
              {previewRows.map((row) => (
                <li
                  key={row.id}
                  className="min-w-0 space-y-2 rounded-2xl border-2 p-3.5"
                  style={{
                    backgroundColor: "var(--bg-cream)",
                    borderColor: "var(--border-color)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono-code rounded-md px-2 py-0.5 text-xs font-extrabold"
                        style={{ backgroundColor: "var(--sky)", color: "#24324a" }}
                      >
                        {row.type}
                      </span>
                      <span className="text-xs font-bold">
                        {localizedRowPurpose(row.id, row.purpose)}
                      </span>
                    </div>
                    <span className="font-mono-code shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                      TTL {row.ttl}s
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div
                      className="flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className="block text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                          {t("claim.hostLabel")}
                        </span>
                        <code className="font-mono-code block truncate text-xs font-bold">
                          {row.host}
                        </code>
                      </div>
                      <CopyButton
                        value={row.host}
                        label={t("claim.copyHostAria", { host: row.host })}
                      />
                    </div>

                    <div
                      className="flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2"
                      style={{
                        backgroundColor: "var(--bg-surface)",
                        borderColor: "var(--border-color)",
                      }}
                    >
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <span className="block text-[10px] font-bold uppercase" style={{ color: "var(--text-muted)" }}>
                          {t("claim.valueLabel")}
                        </span>
                        <code className="font-mono-code block truncate text-xs font-bold">
                          {row.value}
                        </code>
                      </div>
                      <CopyButton
                        value={row.value}
                        label={t("claim.copyValueAria", { value: row.value })}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="space-y-2 border-t pt-3" style={{ borderColor: "var(--shadow-tint)" }}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleVerifyDoh}
                  disabled={verifyingDoh}
                  className="chibi-secondary-btn min-w-[9.5rem] shrink-0"
                >
                  {verifyingDoh ? t("claim.checkingDns") : t("claim.verifyLiveDns")}
                </button>
                <span
                  className="font-mono-code min-w-0 flex-1 truncate text-right text-xs"
                  style={{ color: "var(--text-muted)" }}
                >
                  {fqdn}
                </span>
              </div>

              <div className="min-h-[2.25rem] sm:min-h-[1.25rem]">
                {dohResult ? (
                  <p
                    role="status"
                    className="font-mono-code truncate text-xs font-bold"
                    style={{
                      color:
                        dohResult.status === "found"
                          ? "var(--badge-live-fg)"
                          : dohResult.status === "error"
                            ? "var(--badge-dead-fg)"
                            : "var(--badge-warn-fg)",
                    }}
                  >
                    {dohResult.error
                      ? dohResult.error
                      : dohResult.answers.length > 0
                        ? t("claim.dohLiveFound", {
                            resolver: dohResult.resolver ?? "DoH",
                            answers: dohResult.answers.map((a) => a.data).join(", "),
                          })
                        : t("claim.dohNotPropagated", { status: dohResult.status })}
                  </p>
                ) : (
                  <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                    {t("claim.dohHint")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Static summary label guarantees 1-line stability regardless of domain/prefix length */}
          <details className="chibi-row-card min-w-0 p-5">
            <summary className="cursor-pointer font-display text-sm font-extrabold">
              {t("claim.gitopsSummary")}
            </summary>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor="claim-github" className="text-[11px] font-bold uppercase">
                    {t("claim.githubUsernameLabel")}
                  </label>
                  <input
                    id="claim-github"
                    type="text"
                    value={githubUser}
                    onChange={(e) => setGithubUser(e.target.value)}
                    placeholder="alice-gh"
                    autoComplete="username"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="font-mono-code min-h-10 min-w-0 w-full rounded-xl border-2 px-3 text-sm"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: "var(--border-color)",
                    }}
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                  <label htmlFor="claim-desc" className="text-[11px] font-bold uppercase">
                    {t("claim.shortDescLabel")}
                  </label>
                  <input
                    id="claim-desc"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="min-h-10 min-w-0 w-full rounded-xl border-2 px-3 text-sm"
                    style={{
                      backgroundColor: "var(--bg-surface)",
                      borderColor: "var(--border-color)",
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-mono-code truncate text-xs" style={{ color: "var(--text-muted)" }}>
                  domains/{gitRelativePath}
                </span>
                <CopyButton value={jsonOutput} label={t("claim.copyJsonAria")} showText />
              </div>

              <pre
                className="font-mono-code overflow-x-auto rounded-xl border p-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: "var(--bg-subtle)",
                  borderColor: "var(--border-color)",
                }}
              >
                <code>{jsonOutput}</code>
              </pre>

              <a
                href={githubCreateUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="chibi-secondary-btn w-full"
              >
                {t("claim.openGithubPr")}
              </a>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
