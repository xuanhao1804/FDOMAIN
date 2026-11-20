import type { Metadata } from "next";
import { DirectoryView } from "@/components/directory-view";
import { loadSiteRegistryData } from "@/lib/registry";

export const metadata: Metadata = {
  title: "Directory — FDOMAIN",
};

export default function DirectoryPage() {
  const data = loadSiteRegistryData();
  return <DirectoryView entries={data.entries} rootDomain={data.rootDomain} />;
}
