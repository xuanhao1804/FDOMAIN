import { getConfiguredRootDomains, withTrailingDot } from "./schema.js";
import type {
  CompiledDnsRecord,
  DnsManifest,
  MultiDomainDnsManifest,
  RegistryConfig,
  SubdomainEntry,
  UnmanagedRule,
} from "./types.js";

export interface CompileResult {
  manifest: DnsManifest;
  errors: string[];
  warnings: string[];
}

export function isAdmin(config: RegistryConfig, githubUser: string): boolean {
  const normalized = githubUser.toLowerCase();
  return config.admins.some((admin) => admin.toLowerCase() === normalized);
}

export function isTrusted(config: RegistryConfig, githubUser: string): boolean {
  const normalized = githubUser.toLowerCase();
  return (
    isAdmin(config, githubUser) ||
    config.trusted.some((user) => user.toLowerCase() === normalized)
  );
}

export function isReservedLabel(config: RegistryConfig, label: string): boolean {
  const lower = label.toLowerCase();
  return config.reservedLabels.some((reserved) => reserved.toLowerCase() === lower);
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function matchesUnmanagedRule(
  record: CompiledDnsRecord,
  rule: UnmanagedRule,
): boolean {
  const labelMatches = globToRegex(rule.label).test(record.label);
  if (!labelMatches) return false;

  const types = rule.types.split(",").map((t) => t.trim().toUpperCase());
  const typeMatches = types.includes("*") || types.includes(record.type);
  if (!typeMatches) return false;

  if (!rule.target) return true;
  return globToRegex(rule.target).test(record.value);
}

export function expandEntryRecords(entry: SubdomainEntry): CompiledDnsRecord[] {
  const out: CompiledDnsRecord[] = [];
  const { label, data } = entry;
  const recs = data.records;

  if ("CNAME" in recs) {
    out.push({
      label,
      type: "CNAME",
      value: withTrailingDot(recs.CNAME),
      sourceLabel: label,
    });
  } else {
    for (const ip of recs.A ?? []) {
      out.push({ label, type: "A", value: ip.trim(), sourceLabel: label });
    }
    for (const ip of recs.AAAA ?? []) {
      out.push({ label, type: "AAAA", value: ip.trim(), sourceLabel: label });
    }
    for (const txt of recs.TXT ?? []) {
      out.push({ label, type: "TXT", value: txt, sourceLabel: label });
    }
  }

  for (const verifyTxt of data.vercelVerify ?? []) {
    out.push({
      label: "_vercel",
      type: "TXT",
      value: verifyTxt.trim(),
      sourceLabel: label,
    });
  }

  if (data.extra) {
    for (const [key, extraVal] of Object.entries(data.extra)) {
      const fullLabel = `${key}.${label}`;
      if ("CNAME" in extraVal) {
        out.push({
          label: fullLabel,
          type: "CNAME",
          value: withTrailingDot(extraVal.CNAME),
          sourceLabel: label,
        });
      } else {
        for (const txt of extraVal.TXT) {
          out.push({
            label: fullLabel,
            type: "TXT",
            value: txt,
            sourceLabel: label,
          });
        }
      }
    }
  }

  return out;
}

export function compileRegistry(
  config: RegistryConfig,
  entries: SubdomainEntry[],
  targetRootDomain = config.rootDomain,
): CompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const byLabel = new Map<string, SubdomainEntry>();

  for (const entry of entries) {
    const key = entry.label.toLowerCase();
    if (byLabel.has(key)) {
      errors.push(`Duplicate subdomain label "${entry.label}" in "${targetRootDomain}"`);
      continue;
    }
    byLabel.set(key, entry);
  }

  for (const entry of entries) {
    const owner = entry.data.owner.github;

    if (isReservedLabel(config, entry.label) && !isAdmin(config, owner)) {
      errors.push(
        `Subdomain "${entry.label}" is reserved; only an admin may register or hold it`,
      );
    }

    const dotIndex = entry.label.indexOf(".");
    if (dotIndex !== -1) {
      const parentLabel = entry.label.slice(dotIndex + 1);
      const parent = byLabel.get(parentLabel.toLowerCase());
      if (!parent) {
        const expectedPath =
          targetRootDomain.toLowerCase() === config.rootDomain.toLowerCase()
            ? `domains/${parentLabel}.json`
            : `domains/${targetRootDomain}/${parentLabel}.json`;
        errors.push(
          `Nested subdomain "${entry.label}" requires parent file "${expectedPath}"`,
        );
      } else if (parent.data.owner.github.toLowerCase() !== owner.toLowerCase()) {
        errors.push(
          `Nested subdomain "${entry.label}" (owner "${owner}") must have the same owner as parent "${parentLabel}" (owner "${parent.data.owner.github}")`,
        );
      }
    }
  }

  const allRecords: CompiledDnsRecord[] = [];
  for (const entry of entries) {
    const expanded = expandEntryRecords(entry);
    for (const rec of expanded) {
      for (const rule of config.unmanaged) {
        if (matchesUnmanagedRule(rec, rule)) {
          errors.push(
            `Record ${rec.type} "${rec.label}" -> "${rec.value}" (from ${entry.filename}) conflicts with unmanaged IGNORE rule (${rule.label} / ${rule.types})`,
          );
        }
      }
      allRecords.push(rec);
    }
  }

  allRecords.sort((a, b) => {
    return (
      a.label.localeCompare(b.label) ||
      a.type.localeCompare(b.type) ||
      a.value.localeCompare(b.value)
    );
  });

  if (allRecords.length > config.limits.maxTotalRecords) {
    errors.push(
      `Total generated DNS records (${allRecords.length}) exceeds limit (${config.limits.maxTotalRecords})`,
    );
  } else if (allRecords.length >= config.limits.warnAtRecords) {
    warnings.push(
      `Total generated DNS records (${allRecords.length}) is approaching limit (${config.limits.maxTotalRecords})`,
    );
  }

  return {
    manifest: {
      rootDomain: targetRootDomain,
      unmanaged: config.unmanaged,
      records: allRecords,
    },
    errors,
    warnings,
  };
}

export interface MultiDomainCompileResult {
  manifest: MultiDomainDnsManifest;
  byDomain: Map<string, CompileResult>;
  errors: string[];
  warnings: string[];
  totalRecords: number;
}

/** Compile registry entries grouped per configured root domain. */
export function compileMultiDomainRegistry(
  config: RegistryConfig,
  entries: SubdomainEntry[],
): MultiDomainCompileResult {
  const configured = getConfiguredRootDomains(config);
  const configuredMap = new Map(configured.map((d) => [d.domain.toLowerCase(), d]));
  const grouped = new Map<string, SubdomainEntry[]>();

  for (const d of configured) {
    grouped.set(d.domain.toLowerCase(), []);
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const entry of entries) {
    const targetDomain = (entry.rootDomain ?? config.rootDomain).toLowerCase();
    if (!configuredMap.has(targetDomain)) {
      errors.push(
        `Entry "${entry.filename}" targets unconfigured root domain "${targetDomain}". Add it to config.json rootDomains[].`,
      );
      continue;
    }
    grouped.get(targetDomain)!.push(entry);
  }

  const zones: DnsManifest[] = [];
  const byDomain = new Map<string, CompileResult>();
  let totalRecords = 0;

  for (const domainCfg of configured) {
    const domain = domainCfg.domain.toLowerCase();
    const res = compileRegistry(config, grouped.get(domain) ?? [], domain);
    byDomain.set(domain, res);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
    totalRecords += res.manifest.records.length;
    if (domainCfg.dnsProvider === "cloudflare-gitops") {
      zones.push(res.manifest);
    }
  }

  return {
    manifest: { zones },
    byDomain,
    errors,
    warnings,
    totalRecords,
  };
}
