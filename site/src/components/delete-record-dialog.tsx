"use client";

import { Trash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import type { LiveDnsRecord } from "@/lib/dns-providers/types";
import { Button } from "./ui/button";

export interface DeleteRecordDialogProps {
  record: LiveDnsRecord | null;
  deleting: boolean;
  onConfirm: (allowReserved: boolean) => Promise<void>;
  onClosed: () => void;
}

export function DeleteRecordDialog({
  record,
  deleting,
  onConfirm,
  onClosed,
}: DeleteRecordDialogProps) {
  const t = useTranslations("directory");
  const tCommon = useTranslations("common");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmReserved, setConfirmReserved] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (record) {
      setConfirmReserved(false);
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [record]);

  return (
    <dialog
      ref={dialogRef}
      id="confirm-delete-dialog"
      aria-labelledby="delete-dialog-title"
      className="editorial-modal"
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = "";
        setConfirmReserved(false);
        onClosed();
      }}
    >
      <div className="flex items-center gap-2 border-b border-[var(--badge-dead-border)] bg-[var(--badge-dead-bg)] px-5 py-3.5">
        <Trash size={16} weight="duotone" aria-hidden="true" className="text-[var(--badge-dead-fg)]" />
        <h2 id="delete-dialog-title" className="text-sm font-semibold text-[var(--badge-dead-fg)]">
          {t("deleteDialogTitle")}
        </h2>
      </div>

      <div className="space-y-4 p-5 text-sm">
        {record ? (
          <p className="leading-relaxed text-[var(--text-secondary)]">
            {t("deleteDialogBody", {
              type: record.type,
              fqdn: record.fqdn,
              value: record.value,
              domain: record.domain,
            })}
          </p>
        ) : null}

        {record?.reserved ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[var(--badge-warn-border)] bg-[var(--badge-warn-bg)] p-3 text-xs font-medium text-[var(--badge-warn-fg)]">
            <input
              type="checkbox"
              checked={confirmReserved}
              onChange={(e) => setConfirmReserved(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>{t("deleteReservedConfirm")}</span>
          </label>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            autoFocus
            onClick={() => dialogRef.current?.close("cancel")}
          >
            {tCommon("cancel")}
          </Button>
          <Button
            type="button"
            variant="destructiveSolid"
            disabled={deleting || (Boolean(record?.reserved) && !confirmReserved)}
            onClick={() => void onConfirm(confirmReserved)}
            className="min-w-[8rem]"
          >
            {deleting ? tCommon("deleting") : t("confirmDeleteAction")}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
