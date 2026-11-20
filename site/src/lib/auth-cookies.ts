import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, SESSION_TTL_SECONDS, verifySessionToken } from "./auth";

export async function isServerAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifySessionToken(raw);
}

export function setAdminSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(res: NextResponse): void {
  res.cookies.set(ADMIN_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
