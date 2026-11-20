import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type SubdomainHealth = "live" | "warn" | "dead" | "unknown";

export type DnsProviderType =
  | "namecom"
  | "cloudflare-api"
  | "cloudflare-gitops"
  | "namecheap-manual";

export interface SiteUnmanagedRule {
  label: string;
  types: string;
  target?: string;
}

export interface SiteRootDomainMeta {
  domain: string;
  registrar: string;
  dnsProvider: DnsProviderType;
  note?: string;
  gitRecordCount: number;
}

export interface SiteRecordRow {
  label: string;
  type: string;
  value: string;
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
  unmanaged: SiteUnmanagedRule[];
  limits: {
    maxTotalRecords: number;
    warnAtRecords: number;
  };
  totalDnsRecords: number;
  entries: SiteSubdomainItem[];
}

const DEFAULT_FALLBACK_PAYLOAD: SiteRegistryPayload = {
  rootDomain: "harrylee.dev",
  rootDomains: [
    {
      domain: "harrylee.dev",
      registrar: "Name.com",
      dnsProvider: "namecom",
      note: "Primary dev domain managed via Name.com Core API",
      gitRecordCount: 0,
    },
    {
      domain: "vinamuse.store",
      registrar: "Namecheap",
      dnsProvider: "namecheap-manual",
      note: "Namecheap BasicDNS (copy helper + live DoH check, or switch NS to Cloudflare)",
      gitRecordCount: 0,
    },
  ],
  repository: "xuanhao1804/FDOMAIN",
  lookupSubdomain: "domains",
  generatedAt: new Date(0).toISOString(),
  statusCheckedAt: null,
  reservedLabels: [
    "@",
    "www",
    "mail",
    "admin",
    "domains",
    "status",
    "ns1",
    "ns2",
    "autoconfig",
    "autodiscover",
    "smtp",
    "imap",
    "pop",
    "ftp",
    "webmail",
    "cpanel",
    "localhost",
    "_vercel",
    "_dmarc",
    "_domainkey",
  ],
  unmanaged: [
    { label: "@", types: "*" },
    { label: "www", types: "*" },
    { label: "mail", types: "*" },
    { label: "autoconfig", types: "*" },
    { label: "autodiscover", types: "*" },
    { label: "_dmarc", types: "TXT" },
    { label: "*._domainkey", types: "TXT,CNAME" },
    { label: "_domainkey", types: "TXT" },
    { label: "_vercel", types: "TXT", target: "vc-domain-verify=*" },
  ],
  limits: {
    maxTotalRecords: 180,
    warnAtRecords: 150,
  },
  totalDnsRecords: 0,
  entries: [],
};

function resolveRegistryFilePath(): string | null {
  const candidates = [
    join(process.cwd(), "src", "data", "registry.json"),
    join(process.cwd(), "site", "src", "data", "registry.json"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

let cachedProdRegistry: SiteRegistryPayload | null = null;

export function loadSiteRegistryData(): SiteRegistryPayload {
  if (process.env.NODE_ENV === "production" && cachedProdRegistry) {
    return cachedProdRegistry;
  }

  const dataPath = resolveRegistryFilePath();
  if (!dataPath) {
    return DEFAULT_FALLBACK_PAYLOAD;
  }

  const parsed = JSON.parse(readFileSync(dataPath, "utf8")) as Partial<SiteRegistryPayload>;
  const payload: SiteRegistryPayload = {
    ...DEFAULT_FALLBACK_PAYLOAD,
    ...parsed,
    rootDomains:
      parsed.rootDomains && parsed.rootDomains.length > 0
        ? parsed.rootDomains
        : DEFAULT_FALLBACK_PAYLOAD.rootDomains,
    reservedLabels: parsed.reservedLabels ?? DEFAULT_FALLBACK_PAYLOAD.reservedLabels,
    unmanaged: parsed.unmanaged ?? DEFAULT_FALLBACK_PAYLOAD.unmanaged,
    entries: (parsed.entries ?? []).map((item) => ({
      ...item,
      rootDomain: item.rootDomain ?? parsed.rootDomain ?? DEFAULT_FALLBACK_PAYLOAD.rootDomain,
      dnsProvider: item.dnsProvider ?? "namecom",
    })),
  };

  if (process.env.NODE_ENV === "production") {
    cachedProdRegistry = payload;
  }
  return payload;
}
