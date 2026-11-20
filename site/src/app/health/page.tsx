import type { Metadata } from "next";
import { HealthView } from "@/components/health-view";
import { getServerI18n } from "@/lib/i18n/server";
import { loadSiteRegistryData } from "@/lib/registry";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerI18n();
  return {
    title: t("meta.healthTitle"),
  };
}

export default function HealthPage() {
  const data = loadSiteRegistryData();
  return <HealthView data={data} />;
}
