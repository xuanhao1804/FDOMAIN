import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.05em] whitespace-nowrap",
  {
    variants: {
      variant: {
        live: "border-[var(--badge-live-border)] bg-[var(--badge-live-bg)] text-[var(--badge-live-fg)]",
        info: "border-[var(--badge-info-border)] bg-[var(--badge-info-bg)] text-[var(--badge-info-fg)]",
        warn: "border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] text-[var(--badge-warn-fg)]",
        dead: "border-[var(--badge-dead-border)] bg-[var(--badge-dead-bg)] text-[var(--badge-dead-fg)]",
        neutral:
          "border-[var(--badge-muted-border)] bg-[var(--badge-muted-bg)] text-[var(--badge-muted-fg)]",
        terracotta:
          "border-[var(--badge-dead-border)] bg-[var(--accent-terracotta-bg)] text-[var(--accent-terracotta)]",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
