import type { Metadata } from "next";
import { DirectoryView } from "@/components/directory-view";
import { loadSiteRegistryData } from "@/lib/registry";

export const metadata: Metadata = {
  title: "Directory — FDOMAIN",
};

export const dynamic = "force-dynamic";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const params = await searchParams;
  const data = loadSiteRegistryData();
  const req = params.domain?.trim().toLowerCase();
  const initialDomainFilter =
    req && data.rootDomains.some((d) => d.domain.toLowerCase() === req) ? req : "all";

  return (
    <DirectoryView
      entries={data.entries}
      rootDomains={data.rootDomains}
      initialDomainFilter={initialDomainFilter}
    />
  );
}
