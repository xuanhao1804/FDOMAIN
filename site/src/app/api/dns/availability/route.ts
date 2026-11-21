import { metric } from "@vercel/functions";
import { NextResponse } from "next/server";
import { isServerAdminAuthenticated } from "@/lib/auth-cookies";
import { checkSubdomainAvailability } from "@/lib/availability";
import { loadSiteRegistryData } from "@/lib/registry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const url = new URL(request.url);
  const rawDomain = url.searchParams.get("domain")?.trim().toLowerCase() ?? "";
  const rawLabel = url.searchParams.get("label") ?? "";

  const data = loadSiteRegistryData();
  const domainCfg = rawDomain
    ? data.rootDomains.find((d) => d.domain.toLowerCase() === rawDomain)
    : data.rootDomains.find((d) => d.domain.toLowerCase() === data.rootDomain.toLowerCase()) ??
      data.rootDomains[0];

  if (!domainCfg) {
    return NextResponse.json(
      { error: `Unknown root domain "${rawDomain}".` },
      { status: 400 },
    );
  }

  const isAdmin = await isServerAdminAuthenticated();

  try {
    const outcome = await checkSubdomainAvailability({
      domainCfg,
      rawLabel,
      registryData: data,
      isAdmin,
    });

    if (!outcome.ok) {
      metric("fdomain.dns_availability", 1, {
        status: "error",
        source: "provider-error",
      });
      return NextResponse.json({ error: outcome.error }, { status: outcome.httpStatus });
    }

    metric("fdomain.dns_availability", 1, {
      status: outcome.data.status,
      source: outcome.data.source,
    });
    return NextResponse.json(outcome.data, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } finally {
    metric("fdomain.dns_availability.duration_ms", performance.now() - startedAt);
  }
}
