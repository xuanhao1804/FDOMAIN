import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadConfig, loadDomainEntries } from "./build-dns-manifest.js";
import { isMainModule } from "./lib/cli-utils.js";
import { compileRegistry, expandEntryRecords } from "./lib/compiler.js";
import type { StatusReport, SubdomainHealth } from "./lib/status-check.js";
import type { RegistryConfig, SubdomainEntry } from "./lib/types.js";

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

export function buildSitePayload(
  config: RegistryConfig,
  entries: SubdomainEntry[],
  statusReport: StatusReport | null,
): SiteRegistryPayload {
  const compiled = compileRegistry(config, entries);
  if (compiled.errors.length > 0) {
    throw new Error(`Cannot export site data with invalid registry:\n- ${compiled.errors.join("\n- ")}`);
  }

  const siteEntries: SiteSubdomainItem[] = entries
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((entry) => {
      const fqdn = `${entry.label}.${config.rootDomain}`;
      const expanded = expandEntryRecords(entry).map((rec) => ({
        label: rec.label,
        type: rec.type,
        value: rec.value,
      }));

      const healthEntry = statusReport?.entries[entry.label];
      const health: SiteSubdomainItem["health"] = healthEntry
        ? {
            status: healthEntry.status,
            reason: healthEntry.reason,
            httpStatus: healthEntry.httpStatus,
          }
        : {
            status: "unknown",
            reason: "Not checked yet",
          };

      // Deliberately omit owner.contact so personal contact info is not published on the portal
      return {
        label: entry.label,
        fqdn,
        description: entry.data.description,
        owner: {
          github: entry.data.owner.github,
          avatarUrl: `https://github.com/${encodeURIComponent(entry.data.owner.github)}.png?size=64`,
          profileUrl: `https://github.com/${encodeURIComponent(entry.data.owner.github)}`,
        },
        records: expanded,
        health,
        editUrl: `https://github.com/${config.repository}/edit/main/domains/${encodeURIComponent(entry.filename)}`,
        fileUrl: `https://github.com/${config.repository}/blob/main/domains/${encodeURIComponent(entry.filename)}`,
      };
    });

  return {
    rootDomain: config.rootDomain,
    repository: config.repository,
    lookupSubdomain: config.lookupSubdomain,
    generatedAt: new Date().toISOString(),
    statusCheckedAt: statusReport?.generatedAt ?? null,
    limits: {
      maxTotalRecords: config.limits.maxTotalRecords,
      warnAtRecords: config.limits.warnAtRecords,
    },
    totalDnsRecords: compiled.manifest.records.length,
    entries: siteEntries,
  };
}

export function exportSiteData(repoRoot = process.cwd()): {
  outPath: string;
  count: number;
} {
  const config = loadConfig(repoRoot);
  const entries = loadDomainEntries(config.rootDomain, repoRoot);

  const statusPath = join(repoRoot, "status.json");
  let statusReport: StatusReport | null = null;
  if (existsSync(statusPath)) {
    statusReport = JSON.parse(readFileSync(statusPath, "utf8")) as StatusReport;
  }

  const payload = buildSitePayload(config, entries, statusReport);
  const outPath = resolve(repoRoot, "site", "src", "data", "registry.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return { outPath, count: payload.entries.length };
}

if (isMainModule(import.meta.url)) {
  const res = exportSiteData();
  console.log(`Exported ${res.count} subdomain(s) to ${res.outPath}`);
}
