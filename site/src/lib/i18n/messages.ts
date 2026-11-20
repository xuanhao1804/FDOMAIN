import en from "../../locales/en.json";
import vi from "../../locales/vi.json";
import type { Locale } from "./config";

export type Messages = typeof en;

type DotPrefix<K extends string, V> = V extends Record<string, unknown>
  ? `${K}.${DotKeys<V>}`
  : K;

type DotKeys<T extends Record<string, unknown>> = {
  [K in keyof T & string]: DotPrefix<K, T[K]>;
}[keyof T & string];

export type MessageKey = DotKeys<Messages>;

export type TranslateParams = Record<string, string | number>;

export type Translator = (key: MessageKey, params?: TranslateParams) => string;

export const CATALOGS: Record<Locale, Messages> = {
  en,
  vi,
};

function readPath(obj: Record<string, unknown>, path: string): string | undefined {
  let current: unknown = obj;
  for (const segment of path.split(".")) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(locale: Locale, key: MessageKey, params?: TranslateParams): string {
  const catalog = CATALOGS[locale] ?? CATALOGS.en;
  const template =
    readPath(catalog as unknown as Record<string, unknown>, key) ??
    readPath(CATALOGS.en as unknown as Record<string, unknown>, key) ??
    key;

  if (!params) return template;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, name: string) => {
    const val = params[name];
    return val === undefined ? match : String(val);
  });
}

export function createTranslator(locale: Locale): Translator {
  return (key, params) => translate(locale, key, params);
}

export function getLocalizedDomainNote(
  t: Translator,
  dnsProvider: string,
  registrar: string,
  rawNote?: string,
): string {
  if (dnsProvider === "namecom" && (!rawNote || rawNote.includes("Name.com Core API"))) {
    return t("domains.noteNamecom");
  }
  if (
    dnsProvider === "namecheap-manual" &&
    (!rawNote || rawNote.includes("Namecheap BasicDNS"))
  ) {
    return t("domains.noteNamecheap");
  }
  return rawNote ?? t("domains.noteFallback", { registrar });
}
