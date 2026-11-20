"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  LOCALE_META,
  SUPPORTED_LOCALES,
  type Locale,
} from "@/lib/i18n/config";
import { createTranslator, type Translator } from "@/lib/i18n/messages";

interface I18nContextValue {
  locale: Locale;
  setLocale: (next: Locale) => void;
  t: Translator;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
  t: createTranslator(DEFAULT_LOCALE),
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);

  useEffect(() => {
    setLocaleState(initialLocale);
  }, [initialLocale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE_NAME}=${encodeURIComponent(next)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
  }, []);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      role="group"
      aria-label={t("common.languageSwitcherLabel")}
      className="inline-flex shrink-0 items-center rounded-full border-2 p-0.5"
      style={{
        backgroundColor: "var(--bg-cream)",
        borderColor: "#24324a",
        boxShadow: "0 2px 0 #24324a",
      }}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = locale === code;
        const meta = LOCALE_META[code];
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            aria-label={`${meta.short} — ${meta.nativeName}`}
            onClick={() => setLocale(code)}
            className={`inline-flex cursor-pointer items-center justify-center rounded-full font-mono-code font-extrabold transition-colors ${
              compact ? "min-h-8 min-w-[2.25rem] px-2 text-[11px]" : "min-h-8 min-w-[2.5rem] px-2.5 text-xs"
            }`}
            style={{
              backgroundColor: active ? "var(--mango)" : "transparent",
              color: "#24324a",
            }}
          >
            {meta.short}
          </button>
        );
      })}
    </div>
  );
}
