import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SubdomainHealth = "live" | "warn" | "dead" | "unknown";

export interface SiteRecordRow {
  label: string;
  type: string;
  value: string;
}

export interface SiteSubdomainItem {
  label: string;
  fqdn: string;
  description: string;
  owner: {
    github: string;
    avatarUrl: string;
    profileUrl: string;
  };
  records: SiteRecordRow[];
  health: {
    status: SubdomainHealth;
    reason: string;
    httpStatus?: number;
  };
  editUrl: string;
  fileUrl: string;
}

export interface SiteRegistryPayload {
  rootDomain: string;
  repository: string;
  lookupSubdomain: string;
  generatedAt: string;
  statusCheckedAt: string | null;
  limits: {
    maxTotalRecords: number;
    warnAtRecords: number;
  };
  totalDnsRecords: number;
  entries: SiteSubdomainItem[];
}

export function loadSiteRegistryData(): SiteRegistryPayload {
  const dataPath = join(process.cwd(), "src", "data", "registry.json");
  if (!existsSync(dataPath)) {
    return {
      rootDomain: "harrylee.dev",
      repository: "xuanhao1804/FDOMAIN",
      lookupSubdomain: "domains",
      generatedAt: new Date(0).toISOString(),
      statusCheckedAt: null,
      limits: {
        maxTotalRecords: 180,
        warnAtRecords: 150,
      },
      totalDnsRecords: 0,
      entries: [],
    };
  }

  return JSON.parse(readFileSync(dataPath, "utf8")) as SiteRegistryPayload;
}
