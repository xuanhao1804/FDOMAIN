"use client";

import { ArrowUpRight } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { normalizeExtraPrefix, type SupportedRecordType } from "@/lib/dns-rules";
import { CopyButton } from "./copy-button";
import { Button } from "./ui/button";

export interface GitOpsPrPanelProps {
  repository: string;
  activeDomain: string;
  defaultRootDomain: string;
  cleanLabel: string;
  fqdn: string;
  recordType: SupportedRecordType;
  cleanTarget: string;
  isVercelPreset: boolean;
  vercelVerify: string;
  extraName: string;
  extraTxt: string;
  githubUser: string;
  description: string;
  onGithubUserChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

export function GitOpsPrPanel({
  repository,
  activeDomain,
  defaultRootDomain,
  cleanLabel,
  fqdn,
  recordType,
  cleanTarget,
  isVercelPreset,
  vercelVerify,
  extraName,
  extraTxt,
  githubUser,
  description,
  onGithubUserChange,
  onDescriptionChange,
}: GitOpsPrPanelProps) {
  const t = useTranslations("claim");

  const cleanUser = githubUser.trim() || "your-github-username";
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
  if (!isVercelPreset && normalizedExtra && extraTxt.trim()) {
    gitPayload.extra = { [normalizedExtra]: { TXT: [extraTxt.trim()] } };
  }
  const jsonOutput = `${JSON.stringify(gitPayload, null, 2)}\n`;
  const gitRelativePath =
    activeDomain.toLowerCase() === defaultRootDomain.toLowerCase()
      ? `${cleanLabel}.json`
      : `${activeDomain}/${cleanLabel}.json`;
  const githubCreateUrl = `https://github.com/${repository}/new/main/domains?filename=${encodeURIComponent(gitRelativePath)}&value=${encodeURIComponent(jsonOutput)}`;

  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border-color)] pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="claim-github"
            className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]"
          >
            {t("githubUsernameLabel")}
          </label>
          <input
            id="claim-github"
            type="text"
            value={githubUser}
            onChange={(e) => onGithubUserChange(e.target.value)}
            placeholder="alice-gh"
            autoComplete="username"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="font-mono-code min-h-9 min-w-0 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor="claim-desc"
            className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--text-muted)]"
          >
            {t("shortDescLabel")}
          </label>
          <input
            id="claim-desc"
            type="text"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="min-h-9 min-w-0 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] px-3 text-sm text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono-code truncate text-xs text-[var(--text-muted)]">
          domains/{gitRelativePath}
        </span>
        <CopyButton value={jsonOutput} label={t("copyJsonAria")} showText />
      </div>

      <pre className="font-mono-code overflow-x-auto rounded-lg border border-[var(--border-color)] bg-[var(--bg-paper)] p-3 text-xs leading-relaxed text-[var(--text-primary)]">
        <code>{jsonOutput}</code>
      </pre>

      <Button asChild variant="outline" className="w-full">
        <a href={githubCreateUrl} target="_blank" rel="noopener noreferrer">
          <span>{t("openGithubPr")}</span>
          <ArrowUpRight size={14} weight="bold" aria-hidden="true" />
        </a>
      </Button>
    </div>
  );
}
