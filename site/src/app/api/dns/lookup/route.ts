import { metric } from "@vercel/functions";
import { NextResponse } from "next/server";
import { isFqdnWithinConfiguredDomains, lookupLiveDns } from "@/lib/dns-providers/doh";
import type { SupportedRecordType } from "@/lib/dns-rules";
import { loadSiteRegistryData } from "@/lib/registry";

export const dynamic = "force-dynamic";

const ALLOWED_TYPES = new Set<SupportedRecordType>(["CNAME", "A", "AAAA", "TXT"]);

export async function GET(request: Request) {
  const startedAt = performance.now();
  const url = new URL(request.url);
  const fqdn = url.searchParams.get("fqdn")?.trim().toLowerCase() ?? "";
  const typeRaw = (url.searchParams.get("type")?.trim().toUpperCase() ||
    "CNAME") as SupportedRecordType;

  if (!ALLOWED_TYPES.has(typeRaw)) {
    return NextResponse.json(
      { error: "Supported lookup types are CNAME, A, AAAA, TXT." },
      { status: 400 },
    );
  }

  const data = loadSiteRegistryData();
  const allowedDomains = data.rootDomains.map((d) => d.domain);
  if (!isFqdnWithinConfiguredDomains(fqdn, allowedDomains)) {
    return NextResponse.json(
      {
        error: `Lookup is restricted to configured FDOMAIN zones (${allowedDomains.join(", ")}).`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await lookupLiveDns(fqdn, typeRaw);
    metric("fdomain.doh_lookup", 1, { type: typeRaw, outcome: result.status });
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Live DNS lookup failed.";
    metric("fdomain.doh_lookup", 1, { type: typeRaw, outcome: "error" });
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    metric("fdomain.doh_lookup.duration_ms", performance.now() - startedAt);
  }
}
