import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { compileRegistry } from "./lib/compiler.js";
import { isMainModule } from "./lib/cli-utils.js";
import { filenameToLabel, parseConfig, parseSubdomainFile } from "./lib/schema.js";
import type { RegistryConfig, SubdomainEntry } from "./lib/types.js";

export function loadConfig(repoRoot = process.cwd()): RegistryConfig {
  const raw = JSON.parse(readFileSync(join(repoRoot, "config.json"), "utf8"));
  return parseConfig(raw);
}

export function loadDomainEntries(
  rootDomain: string,
  repoRoot = process.cwd(),
): SubdomainEntry[] {
  const domainsDir = join(repoRoot, "domains");
  const files = readdirSync(domainsDir)
    .filter((name) => name.endsWith(".json"))
    .sort((a, b) => a.localeCompare(b));

  return files.map((filename) => {
    const label = filenameToLabel(filename);
    const raw = JSON.parse(readFileSync(join(domainsDir, filename), "utf8"));
    const data = parseSubdomainFile(raw, label, rootDomain);
    return { label, filename, data };
  });
}

export function buildDnsManifest(repoRoot = process.cwd()): {
  outPath: string;
  recordCount: number;
  warnings: string[];
} {
  const config = loadConfig(repoRoot);
  const entries = loadDomainEntries(config.rootDomain, repoRoot);
  const result = compileRegistry(config, entries);

  if (result.errors.length > 0) {
    throw new Error(`DNS manifest validation failed:\n- ${result.errors.join("\n- ")}`);
  }

  const distDir = resolve(repoRoot, "dist");
  mkdirSync(distDir, { recursive: true });
  const outPath = join(distDir, "dns-manifest.json");
  writeFileSync(outPath, `${JSON.stringify(result.manifest, null, 2)}\n`, "utf8");

  return {
    outPath,
    recordCount: result.manifest.records.length,
    warnings: result.warnings,
  };
}

if (isMainModule(import.meta.url)) {
  const res = buildDnsManifest();
  for (const w of res.warnings) {
    console.warn(`WARN: ${w}`);
  }
  console.log(`Built ${res.outPath} (${res.recordCount} DNS records).`);
}
