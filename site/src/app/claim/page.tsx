import type { Metadata } from "next";
import { ClaimBuilder } from "@/components/claim-builder";
import { loadSiteRegistryData } from "@/lib/registry";

export const metadata: Metadata = {
  title: "Claim & Generate DNS — FDOMAIN",
};

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const params = await searchParams;
  const data = loadSiteRegistryData();
  const requested = params.domain?.trim().toLowerCase();
  const initialDomain =
    data.rootDomains.find((d) => d.domain.toLowerCase() === requested)?.domain ??
    data.rootDomain;

  return (
    <ClaimBuilder
      rootDomains={data.rootDomains}
      initialDomain={initialDomain}
      defaultRootDomain={data.rootDomain}
      repository={data.repository}
      reservedLabels={data.reservedLabels}
      unmanaged={data.unmanaged}
    />
  );
}
