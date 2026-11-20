export const SUPPORTED_LOCALES = ["vi", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "vi";

export const LOCALE_COOKIE_NAME = "fdomain_locale";

export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const LOCALE_META: Record<Locale, { short: string; nativeName: string }> = {
  vi: { short: "VI", nativeName: "Tiếng Việt" },
  en: { short: "EN", nativeName: "English" },
};

export function isSupportedLocale(value: unknown): value is Locale {
  return typeof value === "string" && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function resolveLocale(raw: string | undefined | null): Locale {
  if (!raw) return DEFAULT_LOCALE;
  const normalized = raw.trim().toLowerCase().split("-")[0];
  return isSupportedLocale(normalized) ? normalized : DEFAULT_LOCALE;
}
