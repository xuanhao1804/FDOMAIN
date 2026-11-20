"use client";

import { CheckCircle, Clock, Warning, XCircle } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import type { SubdomainHealth } from "@/lib/registry";
import { Badge } from "./ui/badge";

export function StatusBadge({
  status,
  reason,
}: {
  status: SubdomainHealth;
  reason: string;
}) {
  const t = useTranslations("status");

  if (status === "live") {
    return (
      <Badge variant="live" title={reason} className="min-w-[6.25rem] justify-center">
        <CheckCircle size={12} weight="fill" aria-hidden="true" />
        <span>{t("live")}</span>
      </Badge>
    );
  }
  if (status === "warn") {
    return (
      <Badge variant="warn" title={reason} className="min-w-[6.25rem] justify-center">
        <Warning size={12} weight="fill" aria-hidden="true" />
        <span>{t("warn")}</span>
      </Badge>
    );
  }
  if (status === "dead") {
    return (
      <Badge variant="dead" title={reason} className="min-w-[6.25rem] justify-center">
        <XCircle size={12} weight="fill" aria-hidden="true" />
        <span>{t("dead")}</span>
      </Badge>
    );
  }
  return (
    <Badge variant="neutral" title={reason} className="min-w-[6.25rem] justify-center">
      <Clock size={12} weight="bold" aria-hidden="true" />
      <span>{t("unknown")}</span>
    </Badge>
  );
}
