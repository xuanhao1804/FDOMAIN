"use client";

import { useState } from "react";
import { useI18n } from "./i18n-context";

interface CopyButtonProps {
  value: string;
  label: string;
  showText?: boolean;
}

export function CopyButton({ value, label, showText = false }: CopyButtonProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label}
      className="relative inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold transition-transform active:scale-95"
      style={{
        minInlineSize: showText ? "6.75rem" : undefined,
        borderColor: copied ? "var(--badge-live-fg)" : "var(--border-color)",
        backgroundColor: copied ? "var(--badge-live-bg)" : "var(--bg-surface)",
        color: copied ? "var(--badge-live-fg)" : "var(--text-primary)",
      }}
    >
      {copied ? (
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3.5 8.5 6.5 11.5 12.5 4.5" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="5" width="8.5" height="8.5" rx="2" />
          <path d="M3 11H2.8A1.3 1.3 0 0 1 1.5 9.7V2.8A1.3 1.3 0 0 1 2.8 1.5h6.9A1.3 1.3 0 0 1 11 2.8V3" />
        </svg>
      )}
      {showText ? <span>{copied ? t("common.copied") : t("common.copy")}</span> : null}
      <span
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {copied ? t("common.copied") : ""}
      </span>
    </button>
  );
}
