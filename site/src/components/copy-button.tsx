"use client";

import { Check, Copy } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

interface CopyButtonProps {
  value: string;
  label: string;
  showText?: boolean;
  text?: string;
  className?: string;
}

export function CopyButton({ value, label, showText = false, text, className }: CopyButtonProps) {
  const t = useTranslations("common");
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
    <Button
      type="button"
      variant="outline"
      size={showText ? "sm" : "iconSm"}
      onClick={handleCopy}
      aria-label={label}
      style={showText ? { minInlineSize: text ? "7.75rem" : "6.75rem" } : undefined}
      className={cn(
        copied &&
          "border-[var(--badge-live-border)] bg-[var(--badge-live-bg)] text-[var(--badge-live-fg)] hover:bg-[var(--badge-live-bg)]",
        className,
      )}
    >
      {copied ? (
        <Check size={14} weight="bold" aria-hidden="true" />
      ) : (
        <Copy size={14} weight="duotone" aria-hidden="true" />
      )}
      {showText ? <span>{copied ? t("copied") : (text ?? t("copy"))}</span> : null}
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? t("copied") : ""}
      </span>
    </Button>
  );
}
