import type { Metadata } from "next";
import { ClaimBuilder } from "@/components/claim-builder";
import { loadSiteRegistryData } from "@/lib/registry";

export const metadata: Metadata = {
  title: "Claim Subdomain — FDOMAIN",
};

export default function ClaimPage() {
  const data = loadSiteRegistryData();
  return <ClaimBuilder rootDomain={data.rootDomain} repository={data.repository} />;
}
