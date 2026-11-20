import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HealthView } from "@/components/health-view";
import { loadSiteRegistryData } from "@/lib/registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("healthTitle"),
  };
}

export default function HealthPage() {
  const data = loadSiteRegistryData();
  return <HealthView data={data} />;
}
