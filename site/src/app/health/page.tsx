import type { Metadata } from "next";
import { HealthView } from "@/components/health-view";
import { loadSiteRegistryData } from "@/lib/registry";

export const metadata: Metadata = {
  title: "Health & Quota — FDOMAIN",
};

export default function HealthPage() {
  const data = loadSiteRegistryData();
  return <HealthView data={data} />;
}
