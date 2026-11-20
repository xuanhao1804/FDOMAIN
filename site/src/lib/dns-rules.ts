import type { DnsProviderType, SiteUnmanagedRule } from "./registry";

export type SupportedRecordType = "CNAME" | "A" | "AAAA" | "TXT";

const LABEL_SEGMENT_REGEX = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const FULL_SUBDOMAIN_REGEX =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/;
const HOSTNAME_LABEL_REGEX = /^[a-zA-Z0-9_](?:[a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?$/;
const EXTRA_KEY_REGEX = /^_[a-z0-9-]+$/;

const HARD_LOCKED_TYPES = new Set(["MX", "NS", "SOA", "SRV", "PTR", "CAA"]);

export function isValidSubdomainLabel(raw: string): boolean {
  const label = raw.trim().toLowerCase();
  if (!label || label.length > 190) return false;
  return FULL_SUBDOMAIN_REGEX.test(label) && label.split(".").every((s) => LABEL_SEGMENT_REGEX.test(s));
}

export function isValidIpv4(raw: string): boolean {
  const parts = raw.trim().split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    if (part.length > 1 && part.startsWith("0")) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

export function isValidIpv6(raw: string): boolean {
  const value = raw.trim();
  if (!value || !value.includes(":") || value.length > 45) return false;
  if (!/^[0-9a-fA-F:]+$/.test(value)) return false;
  const doubleColons = value.split("::").length - 1;
  if (doubleColons > 1) return false;
  const groups = value.split(":").filter((g) => g.length > 0);
  if (doubleColons === 0 && groups.length !== 8) return false;
  if (doubleColons === 1 && groups.length > 7) return false;
  return groups.every((g) => g.length >= 1 && g.length <= 4);
}

export function isValidCnameTarget(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("://") || trimmed.includes("/") || trimmed.includes("*")) {
    return false;
  }
  const clean = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  if (!clean || clean.length > 253) return false;
  if (isValidIpv4(clean) || isValidIpv6(clean)) return false;
  const parts = clean.split(".");
  return parts.length >= 2 && parts.every((p) => HOSTNAME_LABEL_REGEX.test(p));
}

export function normalizeTargetValue(type: SupportedRecordType, raw: string): string {
  const trimmed = raw.trim();
  if (type === "CNAME") {
    return trimmed.toLowerCase().replace(/\.+$/, "");
  }
  return trimmed;
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesUnmanagedRule(
  label: string,
  type: string,
  value: string,
  rule: SiteUnmanagedRule,
): boolean {
  if (!globToRegex(rule.label).test(label)) return false;
  const types = rule.types.split(",").map((t) => t.trim().toUpperCase());
  const normalizedType = type.trim().toUpperCase();
  if (!types.includes("*") && !types.includes(normalizedType)) return false;
  if (!rule.target) return true;
  return globToRegex(rule.target).test(value);
}

export function getHardLockReason(
  hostLabel: string,
  type: string,
  value: string,
  unmanagedRules: SiteUnmanagedRule[],
): string | null {
  const cleanLabel = hostLabel.trim().toLowerCase() || "@";
  const upperType = type.trim().toUpperCase();

  if (cleanLabel === "@") {
    return "Root apex (@) records are hard-locked to protect domain routing.";
  }
  if (HARD_LOCKED_TYPES.has(upperType)) {
    return `${upperType} records are managed directly at the DNS provider.`;
  }
  for (const rule of unmanagedRules) {
    if (matchesUnmanagedRule(cleanLabel, upperType, value, rule)) {
      return `Matches protected unmanaged rule (${rule.label} / ${rule.types}).`;
    }
  }
  return null;
}

export function isReservedSubdomainLabel(label: string, reservedLabels: string[]): boolean {
  const clean = label.trim().toLowerCase();
  if (!clean) return false;
  const parts = clean.split(".");
  return reservedLabels.some((res) => {
    const lowerRes = res.toLowerCase();
    return clean === lowerRes || parts.includes(lowerRes);
  });
}

export function normalizeExtraPrefix(raw: string): string | null {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return null;
  const normalized = cleaned.startsWith("_") ? cleaned : `_${cleaned}`;
  if (!EXTRA_KEY_REGEX.test(normalized) || normalized.length > 63) {
    return null;
  }
  return normalized;
}

export interface PreviewDnsRow {
  id: string;
  host: string;
  fqdn: string;
  type: SupportedRecordType;
  value: string;
  ttl: number;
  purpose: "Primary endpoint" | "Vercel ownership verification" | "Service challenge";
}

export interface BuildPreviewInput {
  rootDomain: string;
  dnsProvider: DnsProviderType;
  label: string;
  recordType: SupportedRecordType;
  target: string;
  vercelVerify?: string;
  extraName?: string;
  extraTxt?: string;
  ttl?: number;
}

/** Build the exact DNS record rows needed by Name.com / Namecheap / Cloudflare. */
export function buildPreviewDnsRows(input: BuildPreviewInput): PreviewDnsRow[] {
  const domain = input.rootDomain.trim().toLowerCase();
  const cleanLabel = input.label.trim().toLowerCase();
  const ttl = input.ttl ?? 300;
  const rows: PreviewDnsRow[] = [];

  if (cleanLabel && input.target.trim()) {
    rows.push({
      id: "primary",
      host: cleanLabel,
      fqdn: `${cleanLabel}.${domain}`,
      type: input.recordType,
      value: normalizeTargetValue(input.recordType, input.target),
      ttl,
      purpose: "Primary endpoint",
    });
  }

  const verify = input.vercelVerify?.trim();
  if (verify) {
    rows.push({
      id: "vercel-verify",
      host: "_vercel",
      fqdn: `_vercel.${domain}`,
      type: "TXT",
      value: verify,
      ttl,
      purpose: "Vercel ownership verification",
    });
  }

  const extraPrefix = input.extraName ? normalizeExtraPrefix(input.extraName) : null;
  const extraVal = input.extraTxt?.trim();
  if (extraPrefix && extraVal && cleanLabel) {
    const host = `${extraPrefix}.${cleanLabel}`;
    rows.push({
      id: "extra-challenge",
      host,
      fqdn: `${host}.${domain}`,
      type: "TXT",
      value: extraVal,
      ttl,
      purpose: "Service challenge",
    });
  }

  return rows;
}
