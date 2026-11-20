import { cookies } from "next/headers";
import { LOCALE_COOKIE_NAME, resolveLocale, type Locale } from "./config";
import { createTranslator, type Translator } from "./messages";

export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return resolveLocale(raw);
}

export async function getServerI18n(): Promise<{ locale: Locale; t: Translator }> {
  const locale = await getRequestLocale();
  return { locale, t: createTranslator(locale) };
}
