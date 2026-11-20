import type { SubdomainHealth } from "@/lib/registry";

export const STATUS_META: Record<
  SubdomainHealth,
  { label: string; symbol: string; bgVar: string; fgVar: string }
> = {
  live: {
    label: "Live",
    symbol: "✓",
    bgVar: "var(--badge-live-bg)",
    fgVar: "var(--badge-live-fg)",
  },
  warn: {
    label: "Warn",
    symbol: "!",
    bgVar: "var(--badge-warn-bg)",
    fgVar: "var(--badge-warn-fg)",
  },
  dead: {
    label: "Dead",
    symbol: "×",
    bgVar: "var(--badge-dead-bg)",
    fgVar: "var(--badge-dead-fg)",
  },
  unknown: {
    label: "Pending",
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
  const meta = STATUS_META[status];
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
      <span>{meta.label}</span>
    </span>
  );
}
