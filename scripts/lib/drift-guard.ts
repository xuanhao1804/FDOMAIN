import { compileRegistry } from "./compiler.js";
import { filenameToLabel, parseSubdomainFile } from "./schema.js";
import type { RegistryConfig, SubdomainEntry } from "./types.js";
import type { DomainRawFile } from "./pr-validator.js";

export interface DnscontrolReportEntry {
  domain: string;
  corrections: number;
  correction_details?: string[];
  provider?: string;
}

export interface ParsedCorrection {
  action: "CREATE" | "MODIFY" | "DELETE" | "UNKNOWN";
  fqdn: string;
  recordType: string;
  rawLine: string;
}

export interface DriftGuardInput {
  config: RegistryConfig;
  reportEntries: DnscontrolReportEntry[];
  prevDomainFiles: DomainRawFile[];
  currDomainFiles: DomainRawFile[];
  force?: boolean;
}

export interface DriftGuardResult {
  ok: boolean;
  deletionsCount: number;
  modificationsCount: number;
  creationsCount: number;
  violations: string[];
  summary: string[];
}

const CORRECTION_LINE_REGEX =
  /^([+-]|±)\s+(CREATE|MODIFY(?:-TTL)?|DELETE)\s+(\S+)\s+(\S+)\s*(.*)$/;

export function parseCorrectionLine(line: string): ParsedCorrection {
  const trimmed = line.trim();
  const match = CORRECTION_LINE_REGEX.exec(trimmed);
  if (!match) {
    return { action: "UNKNOWN", fqdn: "", recordType: "", rawLine: trimmed };
  }

  const rawOp = match[2] ?? "";
  const fqdn = (match[3] ?? "").toLowerCase().replace(/\.$/, "");
  const recordType = (match[4] ?? "").toUpperCase();

  let action: ParsedCorrection["action"] = "UNKNOWN";
  if (rawOp === "CREATE") action = "CREATE";
  else if (rawOp.startsWith("MODIFY")) action = "MODIFY";
  else if (rawOp === "DELETE") action = "DELETE";

  return { action, fqdn, recordType, rawLine: trimmed };
}

function toRelativeLabel(fqdn: string, rootDomain: string): string | null {
  const root = rootDomain.toLowerCase().replace(/\.$/, "");
  const normalized = fqdn.toLowerCase().replace(/\.$/, "");
  if (normalized === root) return "@";
  const suffix = `.${root}`;
  if (!normalized.endsWith(suffix)) return null;
  return normalized.slice(0, -suffix.length);
}

function collectManagedLabelsAndVercelTokens(
  config: RegistryConfig,
  files: DomainRawFile[],
): { labels: Set<string>; vercelTokens: Set<string> } {
  const labels = new Set<string>();
  const vercelTokens = new Set<string>();
  const entries: SubdomainEntry[] = [];

  for (const f of files) {
    try {
      const label = filenameToLabel(f.filename);
      const data = parseSubdomainFile(JSON.parse(f.raw), label, config.rootDomain);
      entries.push({ label, filename: f.filename, data });
    } catch {
      // Ignore unparseable historical entries; curr files are pre-validated before deploy
    }
  }

  const compiled = compileRegistry(config, entries);
  for (const rec of compiled.manifest.records) {
    if (rec.label === "_vercel" && rec.type === "TXT") {
      vercelTokens.add(rec.value);
    } else {
      labels.add(rec.label.toLowerCase());
    }
  }

  return { labels, vercelTokens };
}

export function evaluateDriftGuard(input: DriftGuardInput): DriftGuardResult {
  const { config, reportEntries, prevDomainFiles, currDomainFiles, force = false } = input;
  const violations: string[] = [];
  const summary: string[] = [];

  const prev = collectManagedLabelsAndVercelTokens(config, prevDomainFiles);
  const curr = collectManagedLabelsAndVercelTokens(config, currDomainFiles);

  const managedLabels = new Set([...prev.labels, ...curr.labels]);
  const managedVercelTokens = new Set([...prev.vercelTokens, ...curr.vercelTokens]);

  let deletionsCount = 0;
  let modificationsCount = 0;
  let creationsCount = 0;

  for (const entry of reportEntries) {
    if (entry.domain.toLowerCase() !== config.rootDomain.toLowerCase()) continue;
    for (const line of entry.correction_details ?? []) {
      summary.push(line);
      const parsed = parseCorrectionLine(line);

      if (parsed.action === "CREATE") {
        creationsCount += 1;
        continue;
      }

      if (parsed.action === "DELETE") deletionsCount += 1;
      else if (parsed.action === "MODIFY") modificationsCount += 1;
      else {
        violations.push(`Unrecognized DNSControl correction line: "${line}"`);
        continue;
      }

      const relLabel = toRelativeLabel(parsed.fqdn, config.rootDomain);
      if (!relLabel) {
        violations.push(
          `Correction targets domain outside root "${config.rootDomain}": "${line}"`,
        );
        continue;
      }

      if (relLabel === "_vercel" && parsed.recordType === "TXT") {
        const matchesManagedToken = Array.from(managedVercelTokens).some((tok) =>
          line.includes(tok),
        );
        if (!matchesManagedToken) {
          violations.push(
            `Refusing to ${parsed.action} unmanaged _vercel TXT record: "${line}"`,
          );
        }
        continue;
      }

      if (!managedLabels.has(relLabel)) {
        violations.push(
          `Refusing to ${parsed.action} record on unmanaged label "${relLabel}": "${line}"`,
        );
      }
    }
  }

  if (deletionsCount > config.limits.maxDeletionsPerPush) {
    violations.push(
      `Planned deletion count (${deletionsCount}) exceeds maxDeletionsPerPush (${config.limits.maxDeletionsPerPush}).`,
    );
  }

  const ok = force || violations.length === 0;
  return {
    ok,
    deletionsCount,
    modificationsCount,
    creationsCount,
    violations,
    summary,
  };
}
