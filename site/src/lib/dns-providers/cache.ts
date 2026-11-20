import type { LiveDnsRecord } from "./types";

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  expiresAt: number;
  records: LiveDnsRecord[];
}

const publicRecordCache = new Map<string, CacheEntry>();

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

export function invalidateDomainCache(domain: string): void {
  publicRecordCache.delete(domain.toLowerCase());
}
