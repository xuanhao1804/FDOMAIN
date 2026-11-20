import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { loadConfig, loadDomainEntries } from "./build-dns-manifest.js";
import { isMainModule } from "./lib/cli-utils.js";
import { compileMultiDomainRegistry, expandEntryRecords } from "./lib/compiler.js";
import { getConfiguredRootDomains } from "./lib/schema.js";
import type { StatusReport, SubdomainHealth } from "./lib/status-check.js";
import type { DnsProviderType, RegistryConfig, SubdomainEntry, UnmanagedRule } from "./lib/types.js";

export interface SiteRecordRow {
  label: string;
  type: string;
  value: string;
}

export interface SiteRootDomainMeta {
  domain: string;
  registrar: string;
  dnsProvider: DnsProviderType;
  note?: string;
  gitRecordCount: number;
}

export interface SiteSubdomainItem {
  label: string;
  rootDomain: string;
  fqdn: string;
  dnsProvider: DnsProviderType;
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
  rootDomains: SiteRootDomainMeta[];
  repository: string;
  lookupSubdomain: string;
  generatedAt: string;
  statusCheckedAt: string | null;
  reservedLabels: string[];
  unmanaged: UnmanagedRule[];
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
  const compiled = compileMultiDomainRegistry(config, entries);
  if (compiled.errors.length > 0) {
    throw new Error(`Cannot export site data with invalid registry:\n- ${compiled.errors.join("\n- ")}`);
  }

  const domainMetaList = getConfiguredRootDomains(config);
  const providerByDomain = new Map(
    domainMetaList.map((d) => [d.domain.toLowerCase(), d.dnsProvider]),
  );

  const rootDomains: SiteRootDomainMeta[] = domainMetaList.map((d) => ({
    domain: d.domain,
    registrar: d.registrar,
    dnsProvider: d.dnsProvider,
    ...(d.note ? { note: d.note } : {}),
    gitRecordCount: compiled.byDomain.get(d.domain.toLowerCase())?.manifest.records.length ?? 0,
  }));

  const siteEntries: SiteSubdomainItem[] = entries
    .slice()
    .sort((a, b) => {
      const da = (a.rootDomain ?? config.rootDomain).toLowerCase();
      const db = (b.rootDomain ?? config.rootDomain).toLowerCase();
      return da.localeCompare(db) || a.label.localeCompare(b.label);
    })
    .map((entry) => {
      const entryRootDomain = (entry.rootDomain ?? config.rootDomain).toLowerCase();
      const fqdn = `${entry.label}.${entryRootDomain}`;
      const expanded = expandEntryRecords(entry).map((rec) => ({
        label: rec.label,
        type: rec.type,
        value: rec.value,
      }));

      const healthEntry = statusReport?.entries[fqdn] ?? statusReport?.entries[entry.label];
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

      const encodedPath = entry.filename
        .split("/")
        .map((seg) => encodeURIComponent(seg))
        .join("/");

      // Deliberately omit owner.contact so personal contact info is not published on the portal
      return {
        label: entry.label,
        rootDomain: entryRootDomain,
        fqdn,
        dnsProvider: providerByDomain.get(entryRootDomain) ?? "cloudflare-gitops",
        description: entry.data.description,
        owner: {
          github: entry.data.owner.github,
          avatarUrl: `https://github.com/${encodeURIComponent(entry.data.owner.github)}.png?size=64`,
          profileUrl: `https://github.com/${encodeURIComponent(entry.data.owner.github)}`,
        },
        records: expanded,
        health,
        editUrl: `https://github.com/${config.repository}/edit/main/domains/${encodedPath}`,
        fileUrl: `https://github.com/${config.repository}/blob/main/domains/${encodedPath}`,
      };
    });

  return {
    rootDomain: config.rootDomain,
    rootDomains,
    repository: config.repository,
    lookupSubdomain: config.lookupSubdomain,
    generatedAt: new Date().toISOString(),
    statusCheckedAt: statusReport?.generatedAt ?? null,
    reservedLabels: config.reservedLabels,
    unmanaged: config.unmanaged,
    limits: {
      maxTotalRecords: config.limits.maxTotalRecords,
      warnAtRecords: config.limits.warnAtRecords,
    },
    totalDnsRecords: compiled.totalRecords,
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
