import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileMultiDomainRegistry } from "./lib/compiler.js";
import { isMainModule } from "./lib/cli-utils.js";
import {
  filenameToLabel,
  getConfiguredRootDomains,
  parseConfig,
  parseSubdomainFile,
} from "./lib/schema.js";
import type { RegistryConfig, SubdomainEntry } from "./lib/types.js";

export function loadConfig(repoRoot = process.cwd()): RegistryConfig {
  const raw = JSON.parse(readFileSync(join(repoRoot, "config.json"), "utf8"));
  return parseConfig(raw);
}

/** Load root-level `domains/<label>.json` plus per-domain `domains/<rootDomain>/<label>.json`. */
export function loadDomainEntries(
  defaultRootDomain: string,
  repoRoot = process.cwd(),
): SubdomainEntry[] {
  const domainsDir = join(repoRoot, "domains");
  const dirents = readdirSync(domainsDir).sort((a, b) => a.localeCompare(b));
  const out: SubdomainEntry[] = [];

  for (const name of dirents) {
    const fullPath = join(domainsDir, name);
    const stat = statSync(fullPath);

    if (stat.isFile() && name.endsWith(".json")) {
      const label = filenameToLabel(name);
      const raw = JSON.parse(readFileSync(fullPath, "utf8"));
      const data = parseSubdomainFile(raw, label, defaultRootDomain);
      out.push({ label, rootDomain: defaultRootDomain, filename: name, data });
    } else if (stat.isDirectory()) {
      const scopedDomain = name.toLowerCase();
      const subFiles = readdirSync(fullPath)
        .filter((sub) => sub.endsWith(".json"))
        .sort((a, b) => a.localeCompare(b));

      for (const subName of subFiles) {
        const label = filenameToLabel(subName);
        const raw = JSON.parse(readFileSync(join(fullPath, subName), "utf8"));
        const data = parseSubdomainFile(raw, label, scopedDomain);
        out.push({
          label,
          rootDomain: scopedDomain,
          filename: `${scopedDomain}/${subName}`,
          data,
        });
      }
    }
  }

  return out;
}

export function buildDnsManifest(repoRoot = process.cwd()): {
  outPath: string;
  recordCount: number;
  gitopsZoneCount: number;
  warnings: string[];
} {
  const config = loadConfig(repoRoot);
  const entries = loadDomainEntries(config.rootDomain, repoRoot);
  const result = compileMultiDomainRegistry(config, entries);

  if (result.errors.length > 0) {
    throw new Error(`DNS manifest validation failed:\n- ${result.errors.join("\n- ")}`);
  }

  const distDir = resolve(repoRoot, "dist");
  mkdirSync(distDir, { recursive: true });
  const outPath = join(distDir, "dns-manifest.json");
  writeFileSync(outPath, `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8");

  const gitopsZones = getConfiguredRootDomains(config).filter(
    (d) => d.dnsProvider === "cloudflare-gitops",
  ).length;

  return {
    outPath,
    recordCount: result.totalRecords,
    gitopsZoneCount: gitopsZones,
    warnings: result.warnings,
  };
}

if (isMainModule(import.meta.url)) {
  const res = buildDnsManifest();
  for (const w of res.warnings) {
    console.warn(`WARN: ${w}`);
  }
  console.log(
    `Built ${res.outPath} (${res.recordCount} DNS records across ${res.gitopsZoneCount} GitOps zone(s)).`,
  );
}
