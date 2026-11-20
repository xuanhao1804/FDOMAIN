import {
  compileMultiDomainRegistry,
  expandEntryRecords,
  isAdmin,
  isReservedLabel,
  isTrusted,
} from "./compiler.js";
import {
  getConfiguredRootDomains,
  parseDomainRelativePath,
  parseSubdomainFile,
} from "./schema.js";
import type {
  CompiledDnsRecord,
  RegistryConfig,
  SubdomainEntry,
  SubdomainFile,
} from "./types.js";

export interface ChangedFile {
  status: "A" | "M" | "D";
  path: string;
  oldRaw?: string;
  newRaw?: string;
}

export interface DomainRawFile {
  filename: string;
  raw: string;
}

export interface DnsRecordDiff {
  added: CompiledDnsRecord[];
  removed: CompiledDnsRecord[];
}

export interface PrValidationInput {
  config: RegistryConfig;
  prAuthor: string;
  changedFiles: ChangedFile[];
  baseDomainFiles: DomainRawFile[];
  headDomainFiles: DomainRawFile[];
}

export interface PrValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  autoMergeEligible: boolean;
  autoMergeReason: string;
  recordCount: number;
  maxRecords: number;
  dnsDiff: DnsRecordDiff;
}

const DOMAIN_FILE_PATH_REGEX = /^domains\/((?:[^/]+\/)?[^/]+\.json)$/;

function recordKey(rec: CompiledDnsRecord): string {
  return `${rec.rootDomain ?? ""}\0${rec.label}\0${rec.type}\0${rec.value}`;
}

export function diffDnsRecords(
  baseRecords: CompiledDnsRecord[],
  headRecords: CompiledDnsRecord[],
): DnsRecordDiff {
  const baseMap = new Map<string, CompiledDnsRecord>();
  for (const r of baseRecords) baseMap.set(recordKey(r), r);

  const headMap = new Map<string, CompiledDnsRecord>();
  for (const r of headRecords) headMap.set(recordKey(r), r);

  const added: CompiledDnsRecord[] = [];
  const removed: CompiledDnsRecord[] = [];

  for (const [k, r] of headMap) {
    if (!baseMap.has(k)) added.push(r);
  }
  for (const [k, r] of baseMap) {
    if (!headMap.has(k)) removed.push(r);
  }

  const sortFn = (a: CompiledDnsRecord, b: CompiledDnsRecord) =>
    (a.rootDomain ?? "").localeCompare(b.rootDomain ?? "") ||
    a.label.localeCompare(b.label) ||
    a.type.localeCompare(b.type) ||
    a.value.localeCompare(b.value);

  added.sort(sortFn);
  removed.sort(sortFn);
  return { added, removed };
}

function tryParseDomainRaw(
  raw: string,
  filename: string,
  config: RegistryConfig,
): { entry?: SubdomainEntry; error?: string } {
  let rootDomain: string;
  let label: string;
  let normalizedFilename: string;
  try {
    const parsedPath = parseDomainRelativePath(filename, config.rootDomain);
    rootDomain = parsedPath.rootDomain;
    label = parsedPath.label;
    normalizedFilename = parsedPath.filename;
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }

  const allowed = new Set(getConfiguredRootDomains(config).map((d) => d.domain.toLowerCase()));
  if (!allowed.has(rootDomain.toLowerCase())) {
    return {
      error: `Root domain "${rootDomain}" in "domains/${normalizedFilename}" is not listed in config.json rootDomains[].`,
    };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (err) {
    return {
      error: `Invalid JSON in "domains/${normalizedFilename}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    const data: SubdomainFile = parseSubdomainFile(parsedJson, label, rootDomain);
    const entry: SubdomainEntry = normalizedFilename.includes("/")
      ? { label, rootDomain, filename: normalizedFilename, data }
      : { label, filename: normalizedFilename, data };
    return { entry };
  } catch (err) {
    return {
      error: `Schema validation failed for "domains/${normalizedFilename}": ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export function validatePullRequest(input: PrValidationInput): PrValidationResult {
  const { config, prAuthor, changedFiles, baseDomainFiles, headDomainFiles } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  const authorIsAdmin = isAdmin(config, prAuthor);
  const authorIsTrusted = isTrusted(config, prAuthor);

  if (changedFiles.length === 0) {
    errors.push("Pull request contains no file changes.");
  }

  let allDomainFilesOnly = changedFiles.length > 0;
  let touchesReservedLabel = false;

  for (const cf of changedFiles) {
    const match = DOMAIN_FILE_PATH_REGEX.exec(cf.path);
    if (!match || !match[1]) {
      allDomainFilesOnly = false;
      if (!authorIsAdmin) {
        errors.push(
          `Non-admin "${prAuthor}" cannot modify "${cf.path}". Only files inside "domains/*.json" or "domains/<rootDomain>/*.json" may be changed.`,
        );
      }
      continue;
    }

    const filename = match[1];
    let label: string;
    try {
      const parsedPath = parseDomainRelativePath(filename, config.rootDomain);
      label = parsedPath.label;
      const allowed = new Set(getConfiguredRootDomains(config).map((d) => d.domain.toLowerCase()));
      if (!allowed.has(parsedPath.rootDomain.toLowerCase())) {
        errors.push(
          `Root domain "${parsedPath.rootDomain}" in "${cf.path}" is not configured in config.json.`,
        );
        continue;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      continue;
    }

    if (isReservedLabel(config, label)) {
      touchesReservedLabel = true;
      if (!authorIsAdmin) {
        errors.push(
          `Subdomain "${label}" is reserved; only an admin may create, modify, or delete it.`,
        );
      }
    }

    let oldOwner: string | undefined;
    let newOwner: string | undefined;

    if (cf.status === "M" || cf.status === "D") {
      if (cf.oldRaw === undefined) {
        errors.push(`Missing base file contents for "${cf.path}".`);
      } else {
        const parsedOld = tryParseDomainRaw(cf.oldRaw, filename, config);
        if (parsedOld.error && !authorIsAdmin) {
          errors.push(parsedOld.error);
        } else if (parsedOld.entry) {
          oldOwner = parsedOld.entry.data.owner.github;
          if (!authorIsAdmin && oldOwner.toLowerCase() !== prAuthor.toLowerCase()) {
            errors.push(
              `Permission denied changing "${cf.path}": existing owner is "${oldOwner}", PR author is "${prAuthor}".`,
            );
          }
        }
      }
    }

    if (cf.status === "A" || cf.status === "M") {
      if (cf.newRaw === undefined) {
        errors.push(`Missing head file contents for "${cf.path}".`);
      } else {
        const parsedNew = tryParseDomainRaw(cf.newRaw, filename, config);
        if (parsedNew.error) {
          errors.push(parsedNew.error);
        } else if (parsedNew.entry) {
          newOwner = parsedNew.entry.data.owner.github;
          if (!authorIsAdmin && newOwner.toLowerCase() !== prAuthor.toLowerCase()) {
            errors.push(
              `Permission denied setting owner "${newOwner}" in "${cf.path}": PR author must match owner.github ("${prAuthor}").`,
            );
          }
        }
      }
    }

    if (
      oldOwner &&
      newOwner &&
      oldOwner.toLowerCase() !== newOwner.toLowerCase() &&
      !authorIsAdmin
    ) {
      errors.push(
        `Transferring ownership of "${cf.path}" from "${oldOwner}" to "${newOwner}" requires an admin.`,
      );
    }
  }

  const headEntries: SubdomainEntry[] = [];
  for (const file of headDomainFiles) {
    const parsed = tryParseDomainRaw(file.raw, file.filename, config);
    if (parsed.error) {
      if (!errors.includes(parsed.error)) {
        errors.push(parsed.error);
      }
    } else if (parsed.entry) {
      headEntries.push(parsed.entry);
    }
  }

  const baseEntries: SubdomainEntry[] = [];
  for (const file of baseDomainFiles) {
    const parsed = tryParseDomainRaw(file.raw, file.filename, config);
    if (parsed.entry) {
      baseEntries.push(parsed.entry);
    }
  }

  const compiledHead = compileMultiDomainRegistry(config, headEntries);
  errors.push(...compiledHead.errors);
  warnings.push(...compiledHead.warnings);

  const tagRecordDomain = (entry: SubdomainEntry) =>
    expandEntryRecords(entry).map((r) =>
      entry.rootDomain ? { ...r, rootDomain: entry.rootDomain } : r,
    );
  const baseRecords = baseEntries.flatMap(tagRecordDomain);
  const headRecords = headEntries.flatMap(tagRecordDomain);
  const dnsDiff = diffDnsRecords(baseRecords, headRecords);

  const ok = errors.length === 0;
  let autoMergeEligible = false;
  let autoMergeReason = "";

  if (!ok) {
    autoMergeReason = "Validation failed.";
  } else if (!authorIsTrusted) {
    autoMergeReason = `Author "${prAuthor}" is not in trusted[] or admins[]; manual admin review required.`;
  } else if (!allDomainFilesOnly) {
    autoMergeReason = "PR touches files outside domains/; manual review required.";
  } else if (touchesReservedLabel && !authorIsAdmin) {
    autoMergeReason = "PR touches a reserved label; manual admin review required.";
  } else {
    autoMergeEligible = true;
    autoMergeReason = authorIsAdmin
      ? `Author "${prAuthor}" is an admin and all checks passed.`
      : `Author "${prAuthor}" is in trusted[] and only changed owned non-reserved subdomain files.`;
  }

  return {
    ok,
    errors,
    warnings,
    autoMergeEligible,
    autoMergeReason,
    recordCount: compiledHead.totalRecords,
    maxRecords: config.limits.maxTotalRecords,
    dnsDiff,
  };
}
