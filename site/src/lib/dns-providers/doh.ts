import type { SupportedRecordType } from "../dns-rules";

export interface DohAnswer {
  name: string;
  type: number;
  TTL: number;
  data: string;
}

export interface DohLookupResult {
  fqdn: string;
  type: SupportedRecordType;
  status: "found" | "nxdomain" | "empty";
  resolver: "cloudflare-doh" | "google-doh";
  answers: Array<{ data: string; ttl: number }>;
}

const TYPE_CODE_MAP: Record<SupportedRecordType, number> = {
  A: 1,
  CNAME: 5,
  TXT: 16,
  AAAA: 28,
};

function normalizeAnswerData(type: SupportedRecordType, raw: string): string {
  const trimmed = raw.trim();
  if (type === "CNAME") {
    return trimmed.toLowerCase().replace(/\.+$/, "");
  }
  if (type === "TXT" && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function isFqdnWithinConfiguredDomains(fqdn: string, allowedDomains: string[]): boolean {
  const clean = fqdn.trim().toLowerCase().replace(/\.+$/, "");
  if (!clean || clean.length > 253) return false;
  return allowedDomains.some((domain) => {
    const root = domain.toLowerCase();
    return clean === root || clean.endsWith(`.${root}`);
  });
}

async function querySingleDoh(
  url: string,
  fqdn: string,
  type: SupportedRecordType,
  resolver: DohLookupResult["resolver"],
  fetchImpl: typeof fetch,
): Promise<DohLookupResult> {
  const res = await fetchImpl(url, {
    method: "GET",
    headers: { Accept: "application/dns-json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) {
    throw new Error(`${resolver} HTTP ${res.status}`);
  }
  const data = (await res.json()) as { Status?: number; Answer?: DohAnswer[] };
  const expectedTypeCode = TYPE_CODE_MAP[type];
  const answers = (data.Answer ?? [])
    .filter((a) => a.type === expectedTypeCode)
    .map((a) => ({
      data: normalizeAnswerData(type, a.data),
      ttl: a.TTL,
    }));

  const status: DohLookupResult["status"] =
    data.Status === 3 ? "nxdomain" : answers.length > 0 ? "found" : "empty";

  return {
    fqdn,
    type,
    status,
    resolver,
    answers,
  };
}

export async function lookupLiveDns(
  fqdn: string,
  type: SupportedRecordType,
  fetchImpl: typeof fetch = fetch,
): Promise<DohLookupResult> {
  const cleanFqdn = fqdn.trim().toLowerCase().replace(/\.+$/, "");
  const cfUrl = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanFqdn)}&type=${type}`;
  try {
    return await querySingleDoh(cfUrl, cleanFqdn, type, "cloudflare-doh", fetchImpl);
  } catch {
    const googleUrl = `https://dns.google/resolve?name=${encodeURIComponent(cleanFqdn)}&type=${type}`;
    return await querySingleDoh(googleUrl, cleanFqdn, type, "google-doh", fetchImpl);
  }
}
