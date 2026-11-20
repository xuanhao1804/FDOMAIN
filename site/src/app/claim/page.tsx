import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClaimBuilder } from "@/components/claim-builder";
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
