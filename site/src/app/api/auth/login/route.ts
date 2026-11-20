import { metric } from "@vercel/functions";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assertSameOrigin,
  createSessionToken,
  isAdminAuthConfigured,
  verifyAdminPassword,
} from "@/lib/auth";
import { setAdminSessionCookie } from "@/lib/auth-cookies";

const LoginBodySchema = z.object({
  password: z.string().min(1, "Password is required").max(256),
});

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  if (!isAdminAuthConfigured()) {
    metric("fdomain.admin_login", 1, { outcome: "unconfigured" });
    return NextResponse.json(
      {
        error:
          "ADMIN_PASSWORD is not configured on this server. Add ADMIN_PASSWORD in .env.local or Vercel Project Environment Variables.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = LoginBodySchema.safeParse(body);
  if (!parsed.success) {
    metric("fdomain.admin_login", 1, { outcome: "invalid_input" });
    return NextResponse.json({ error: "Password is required." }, { status: 400 });
  }

  if (!verifyAdminPassword(parsed.data.password)) {
    metric("fdomain.admin_login", 1, { outcome: "unauthorized" });
    return NextResponse.json({ error: "Incorrect admin password." }, { status: 401 });
  }

  const token = createSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unable to create session token." }, { status: 500 });
  }

  metric("fdomain.admin_login", 1, { outcome: "success" });
  const response = NextResponse.json({ authenticated: true });
  setAdminSessionCookie(response, token);
  return response;
}
