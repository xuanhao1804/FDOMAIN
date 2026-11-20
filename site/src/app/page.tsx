import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OverviewView } from "@/components/overview-view";
import { loadSiteRegistryData } from "@/lib/registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("overviewTitle"),
  };
}

export default function OverviewPage() {
  const data = loadSiteRegistryData();
  return <OverviewView data={data} />;
}
