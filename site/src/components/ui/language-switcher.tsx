"use client";

import { CaretDown, Check, Translate } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setUserLocale } from "@/app/actions/locale";
import { LOCALE_META, SUPPORTED_LOCALES, type Locale } from "@/i18n/config";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const t = useTranslations("common");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentMeta = LOCALE_META[locale] ?? LOCALE_META.vi;

  function handleSelect(nextLocale: string) {
    if (nextLocale === locale) return;
    startTransition(async () => {
      await setUserLocale(nextLocale);
      document.documentElement.lang = nextLocale;
      router.refresh();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isPending}
          aria-label={`${currentMeta.short} — ${t("languageSwitcherAria")}`}
          className="min-w-[4.75rem] justify-between gap-1.5 font-mono-code"
        >
          <span className="inline-flex items-center gap-1.5">
            <Translate size={15} weight="duotone" aria-hidden="true" />
            <span>{currentMeta.short}</span>
          </span>
          <CaretDown size={12} weight="bold" aria-hidden="true" className="opacity-65" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t("languageLabel")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={handleSelect}>
          {SUPPORTED_LOCALES.map((code) => {
            const meta = LOCALE_META[code];
            const active = code === locale;
            return (
              <DropdownMenuRadioItem key={code} value={code} lang={code}>
                <span className="flex items-center gap-2">
                  <span className="font-mono-code inline-flex w-6 justify-center rounded border border-[var(--border-color)] bg-[var(--bg-paper)] px-1 py-0.5 text-[10px] font-semibold">
                    {meta.short}
                  </span>
                  <span>{meta.nativeName}</span>
                </span>
                {active ? (
                  <Check size={14} weight="bold" aria-hidden="true" className="text-[var(--accent-terracotta)]" />
                ) : (
                  <span className="inline-block w-3.5" aria-hidden="true" />
                )}
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
