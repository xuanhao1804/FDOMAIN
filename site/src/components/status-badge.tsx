"use client";

import type { SubdomainHealth } from "@/lib/registry";
import { useI18n } from "./i18n-context";

export const STATUS_META: Record<
  SubdomainHealth,
  { symbol: string; bgVar: string; fgVar: string }
> = {
  live: {
    symbol: "✓",
    bgVar: "var(--badge-live-bg)",
    fgVar: "var(--badge-live-fg)",
  },
  warn: {
    symbol: "!",
    bgVar: "var(--badge-warn-bg)",
    fgVar: "var(--badge-warn-fg)",
  },
  dead: {
    symbol: "×",
    bgVar: "var(--badge-dead-bg)",
    fgVar: "var(--badge-dead-fg)",
  },
  unknown: {
    symbol: "•",
    bgVar: "var(--badge-muted-bg)",
    fgVar: "var(--badge-muted-fg)",
  },
};

export function StatusBadge({
  status,
  reason,
}: {
  status: SubdomainHealth;
  reason: string;
}) {
  const { t } = useI18n();
  const meta = STATUS_META[status];
  const label =
    status === "live"
      ? t("status.live")
      : status === "warn"
        ? t("status.warn")
        : status === "dead"
          ? t("status.dead")
          : t("status.unknown");

  return (
    <span
      title={reason}
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-wide"
      style={{
        backgroundColor: meta.bgVar,
        color: meta.fgVar,
        borderColor: meta.fgVar,
      }}
    >
      <span aria-hidden="true">{meta.symbol}</span>
      <span>{label}</span>
    </span>
  );
}
