import type { LiveDnsRecord } from "@/lib/dns-providers/types";

interface CacheEntry {
  records: LiveDnsRecord[];
  cachedAt: number;
}

const LIVE_RECORDS_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

function cacheKey(authenticated: boolean): string {
  return authenticated ? "admin" : "public";
}

export function getCachedLiveRecords(authenticated: boolean): LiveDnsRecord[] | null {
  const entry = cache.get(cacheKey(authenticated));
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > LIVE_RECORDS_TTL_MS) {
    cache.delete(cacheKey(authenticated));
    return null;
  }
  return entry.records;
}

export function setCachedLiveRecords(authenticated: boolean, records: LiveDnsRecord[]): void {
  cache.set(cacheKey(authenticated), {
    records,
    cachedAt: Date.now(),
  });
}

export function invalidateLiveRecordsCache(): void {
  cache.clear();
}
