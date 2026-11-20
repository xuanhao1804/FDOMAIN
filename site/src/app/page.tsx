import type { Metadata } from "next";
import { OverviewView } from "@/components/overview-view";
import { getServerI18n } from "@/lib/i18n/server";
import { loadSiteRegistryData } from "@/lib/registry";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("meta.overviewTitle"),
  };
}

export default function OverviewPage() {
  const data = loadSiteRegistryData();
  return <OverviewView data={data} />;
}
