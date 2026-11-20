"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  type Locale,
} from "@/i18n/config";

export async function setUserLocale(nextLocale: string): Promise<Locale> {
  const locale = resolveLocale(nextLocale);
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    path: "/",
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
  return locale;
}
