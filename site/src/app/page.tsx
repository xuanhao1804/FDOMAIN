import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { HomeStudio } from "@/components/home-studio";
import { loadSiteRegistryData } from "@/lib/registry";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: t("overviewTitle"),
  };
}

export default function HomePage() {
  const data = loadSiteRegistryData();
  return (
    <HomeStudio
      rootDomains={data.rootDomains}
      defaultRootDomain={data.rootDomain}
    />
  );
}
