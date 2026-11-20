import { isAdminAuthConfigured } from "../auth";
import { getHardLockReason, isReservedSubdomainLabel } from "../dns-rules";
import type { SiteRootDomainMeta, SiteUnmanagedRule } from "../registry";
import {
  getCachedPublicRecords,
  invalidateDomainCache,
  setCachedPublicRecords,
} from "./cache";
import {
  createCloudflareRecord,
  deleteCloudflareRecord,
  isCloudflareConfigured,
  listCloudflareRecords,
} from "./cloudflare";
import {
  createNamecomRecord,
  deleteNamecomRecord,
  isNamecomConfigured,
  listNamecomRecords,
} from "./namecom";
import type {
  CreatedProviderRecord,
  CreateProviderRecordInput,
  DomainCapability,
  LiveDnsRecord,
  ProviderEnvStatus,
} from "./types";

const SAFE_PUBLIC_TYPES = new Set(["A", "AAAA", "CNAME"]);

export function getProviderEnvStatus(): ProviderEnvStatus {
  return {
    adminAuthConfigured: isAdminAuthConfigured(),
    namecomConfigured: isNamecomConfigured(),
    cloudflareConfigured: isCloudflareConfigured(),
  };
}

export function getDomainCapability(domainCfg: SiteRootDomainMeta): DomainCapability {
  let mode: DomainCapability["mode"] = "manual-copy";
  if (domainCfg.dnsProvider === "namecom") {
    mode = isNamecomConfigured() ? "auto-ready" : "auto-needs-env";
  } else if (
    domainCfg.dnsProvider === "cloudflare-api" ||
    domainCfg.dnsProvider === "cloudflare-gitops"
  ) {
    mode = isCloudflareConfigured() ? "auto-ready" : "auto-needs-env";
  }

  return {
    domain: domainCfg.domain,
    registrar: domainCfg.registrar,
    dnsProvider: domainCfg.dnsProvider,
    mode,
    note: domainCfg.note,
  };
}

function decorateRecords(
  rawRecords: CreatedProviderRecord[],
  domainCfg: SiteRootDomainMeta,
  unmanagedRules: SiteUnmanagedRule[],
  reservedLabels: string[],
  isAdmin: boolean,
): LiveDnsRecord[] {
  return rawRecords.map((rec) => {
    const hardReason = getHardLockReason(rec.host, rec.type, rec.value, unmanagedRules);
    const reserved = isReservedSubdomainLabel(rec.host, reservedLabels);
    const isProtected = hardReason !== null;
    return {
      id: isAdmin ? rec.id : null,
      domain: domainCfg.domain,
      host: rec.host,
      fqdn: rec.fqdn,
      type: rec.type,
      value: rec.value,
      ttl: rec.ttl,
      provider: domainCfg.dnsProvider,
      protected: isProtected,
      protectedReason: hardReason,
      reserved,
      canDelete: isAdmin && !isProtected && domainCfg.dnsProvider !== "namecheap-manual",
    };
  });
}

export async function fetchDomainRecords(
  domainCfg: SiteRootDomainMeta,
  unmanagedRules: SiteUnmanagedRule[],
  reservedLabels: string[],
  isAdmin: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<{ records: LiveDnsRecord[]; source: "live-api" | "manual" | "unconfigured" }> {
  if (domainCfg.dnsProvider === "namecheap-manual") {
    return { records: [], source: "manual" };
  }

  const cap = getDomainCapability(domainCfg);
  if (cap.mode === "auto-needs-env") {
    return { records: [], source: "unconfigured" };
  }

  if (!isAdmin) {
    const cached = getCachedPublicRecords(domainCfg.domain);
    if (cached) {
      return { records: cached, source: "live-api" };
    }
  }

  const raw =
    domainCfg.dnsProvider === "namecom"
      ? await listNamecomRecords(domainCfg.domain, fetchImpl)
      : await listCloudflareRecords(domainCfg.domain, fetchImpl);

  const decorated = decorateRecords(raw, domainCfg, unmanagedRules, reservedLabels, isAdmin);
  if (isAdmin) {
    return { records: decorated, source: "live-api" };
  }

  // Public unauthenticated view exposes only non-protected web endpoints (A/AAAA/CNAME),
  // redacting apex, unmanaged, mail, TXTs, and reserved infrastructure hosts.
  const safeSubset = decorated.filter(
    (rec) => !rec.protected && !rec.reserved && SAFE_PUBLIC_TYPES.has(rec.type),
  );
  setCachedPublicRecords(domainCfg.domain, safeSubset);
  return { records: safeSubset, source: "live-api" };
}

export async function createProviderRecords(
  domainCfg: SiteRootDomainMeta,
  items: CreateProviderRecordInput[],
  unmanagedRules: SiteUnmanagedRule[],
  reservedLabels: string[],
  allowReserved: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveDnsRecord[]> {
  if (domainCfg.dnsProvider === "namecheap-manual") {
    throw new Error(
      `Domain "${domainCfg.domain}" is configured for Namecheap BasicDNS manual copy. Copy the generated records into Namecheap Advanced DNS, or switch its nameservers to Cloudflare.`,
    );
  }

  for (const item of items) {
    const hardReason = getHardLockReason(item.host, item.type, item.value, unmanagedRules);
    if (hardReason) {
      // Explicitly allow _vercel TXT verification tokens when creating a project subdomain
      const isVercelVerifyTxt =
        item.host.toLowerCase() === "_vercel" &&
        item.type === "TXT" &&
        item.value.startsWith("vc-domain-verify=");
      if (!isVercelVerifyTxt) {
        throw new Error(`Blocked protected DNS change on "${item.host}": ${hardReason}`);
      }
    }

    if (
      item.host.toLowerCase() !== "_vercel" &&
      isReservedSubdomainLabel(item.host, reservedLabels) &&
      !allowReserved
    ) {
      throw new Error(
        `Subdomain "${item.host}" uses a reserved label. Confirm reserved override explicitly before applying.`,
      );
    }
  }

  const createdRaw: CreatedProviderRecord[] = [];
  for (const item of items) {
    const rec =
      domainCfg.dnsProvider === "namecom"
        ? await createNamecomRecord(domainCfg.domain, item, fetchImpl)
        : await createCloudflareRecord(domainCfg.domain, item, fetchImpl);
    createdRaw.push(rec);
  }

  invalidateDomainCache(domainCfg.domain);
  return decorateRecords(createdRaw, domainCfg, unmanagedRules, reservedLabels, true);
}

export async function removeProviderRecord(
  domainCfg: SiteRootDomainMeta,
  recordId: string,
  unmanagedRules: SiteUnmanagedRule[],
  reservedLabels: string[],
  allowReserved: boolean,
  fetchImpl: typeof fetch = fetch,
): Promise<LiveDnsRecord> {
  if (domainCfg.dnsProvider === "namecheap-manual") {
    throw new Error(`Domain "${domainCfg.domain}" does not support API record deletion.`);
  }

  // Re-fetch authoritative records first so a spoofed ID cannot delete an unmanaged apex/MX record
  const rawList =
    domainCfg.dnsProvider === "namecom"
      ? await listNamecomRecords(domainCfg.domain, fetchImpl)
      : await listCloudflareRecords(domainCfg.domain, fetchImpl);

  const target = rawList.find((r) => r.id === recordId);
  if (!target) {
    throw new Error(`DNS record "${recordId}" was not found on "${domainCfg.domain}".`);
  }

  const hardReason = getHardLockReason(target.host, target.type, target.value, unmanagedRules);
  if (hardReason) {
    throw new Error(`Cannot delete protected record "${target.fqdn}" (${target.type}): ${hardReason}`);
  }

  if (isReservedSubdomainLabel(target.host, reservedLabels) && !allowReserved) {
    throw new Error(
      `Record "${target.fqdn}" targets a reserved label. Confirm reserved deletion explicitly.`,
    );
  }

  if (domainCfg.dnsProvider === "namecom") {
    await deleteNamecomRecord(domainCfg.domain, recordId, fetchImpl);
  } else {
    await deleteCloudflareRecord(domainCfg.domain, recordId, fetchImpl);
  }

  invalidateDomainCache(domainCfg.domain);
  return decorateRecords([target], domainCfg, unmanagedRules, reservedLabels, true)[0]!;
}
