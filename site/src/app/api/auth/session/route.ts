import { NextResponse } from "next/server";
import { isAdminAuthConfigured } from "@/lib/auth";
import { isServerAdminAuthenticated } from "@/lib/auth-cookies";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = isAdminAuthConfigured();
  const authenticated = configured ? await isServerAdminAuthenticated() : false;
  return NextResponse.json({ authenticated, configured });
}
