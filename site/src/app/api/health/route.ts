import { NextResponse } from "next/server";
import { getDomainCapability, getProviderEnvStatus } from "@/lib/dns-providers";
import { loadSiteRegistryData } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = loadSiteRegistryData();
  const env = getProviderEnvStatus();
  const domains = data.rootDomains.map(getDomainCapability);

  return NextResponse.json({
    ok: true,
    env,
    domains,
  });
}
