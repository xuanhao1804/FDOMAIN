import { NextResponse } from "next/server";
import { getDomainCapability, getProviderEnvStatus } from "@/lib/dns-providers";
import { loadSiteRegistryData } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = loadSiteRegistryData();
  return NextResponse.json({
    defaultDomain: data.rootDomain,
    domains: data.rootDomains.map(getDomainCapability),
    env: getProviderEnvStatus(),
  });
}
