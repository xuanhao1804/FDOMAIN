import type { LiveDnsRecord } from "./types";

const CACHE_TTL_MS = 60_000;
const HOST_CACHE_TTL_MS = 30_000;

interface CacheEntry {
  expiresAt: number;
  records: LiveDnsRecord[];
}

interface HostCacheEntry {
  expiresAt: number;
  hosts: Set<string>;
}

const publicRecordCache = new Map<string, CacheEntry>();
const domainHostCache = new Map<string, HostCacheEntry>();

export function getCachedPublicRecords(domain: string, now = Date.now()): LiveDnsRecord[] | null {
  const key = domain.toLowerCase();
  const hit = publicRecordCache.get(key);
  if (!hit) return null;
  if (now > hit.expiresAt) {
    publicRecordCache.delete(key);
    return null;
  }
  return hit.records;
}

export function setCachedPublicRecords(
  domain: string,
  records: LiveDnsRecord[],
  now = Date.now(),
): void {
  publicRecordCache.set(domain.toLowerCase(), {
    expiresAt: now + CACHE_TTL_MS,
    records,
  });
}

export function getCachedDomainHosts(domain: string, now = Date.now()): Set<string> | null {
  const key = domain.toLowerCase();
  const hit = domainHostCache.get(key);
  if (!hit) return null;
  if (now > hit.expiresAt) {
    domainHostCache.delete(key);
    return null;
  }
  return hit.hosts;
}

export function setCachedDomainHosts(
  domain: string,
  hosts: Iterable<string>,
  now = Date.now(),
): void {
  const normalized = new Set<string>();
  for (const host of hosts) {
    normalized.add(host.trim().toLowerCase());
  }
  domainHostCache.set(domain.toLowerCase(), {
    expiresAt: now + HOST_CACHE_TTL_MS,
    hosts: normalized,
  });
}

export function invalidateDomainCache(domain: string): void {
  const key = domain.toLowerCase();
  publicRecordCache.delete(key);
  domainHostCache.delete(key);
}
