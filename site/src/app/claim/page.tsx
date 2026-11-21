import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClaimBuilder } from "@/components/claim-builder";
import { isValidSubdomainLabel } from "@/lib/dns-rules";
import { loadSiteRegistryData } from "@/lib/registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("claimTitle"),
  };
}

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string; label?: string }>;
}) {
  const params = await searchParams;
  const data = loadSiteRegistryData();
  const requestedDomain = params.domain?.trim().toLowerCase();
  const initialDomain =
    data.rootDomains.find((d) => d.domain.toLowerCase() === requestedDomain)?.domain ??
    data.rootDomain;

  const requestedLabel = params.label?.trim().toLowerCase() ?? "";
  const initialLabel =
    requestedLabel && isValidSubdomainLabel(requestedLabel) ? requestedLabel : "";

  return (
    <ClaimBuilder
      rootDomains={data.rootDomains}
      initialDomain={initialDomain}
      initialLabel={initialLabel}
      defaultRootDomain={data.rootDomain}
      repository={data.repository}
      reservedLabels={data.reservedLabels}
      unmanaged={data.unmanaged}
    />
  );
}
