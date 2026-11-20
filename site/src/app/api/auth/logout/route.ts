import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/auth";
import { clearAdminSessionCookie } from "@/lib/auth-cookies";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const response = NextResponse.json({ authenticated: false });
  clearAdminSessionCookie(response);
  return response;
}
