import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadConfig, loadDomainEntries } from "./build-dns-manifest.js";
import { isMainModule } from "./lib/cli-utils.js";
import { compileMultiDomainRegistry } from "./lib/compiler.js";
import { filenameToLabel, getConfiguredRootDomains, parseSubdomainFile } from "./lib/schema.js";
import type { SubdomainFile } from "./lib/types.js";

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function getMultiFlag(args: string[], name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) {
      out.push(args[i + 1]!);
    }
  }
  return out;
}

function printUsage(): void {
  console.log(`FDOMAIN Admin CLI
Usage:
  npm run sub -- list
  npm run sub -- add <label> [--domain <rootDomain>] --cname <target> [--owner <github>] [--desc <text>] [--vercel-verify <token>] [--push]
  npm run sub -- add <label> [--domain <rootDomain>] [--a <ip1,ip2>] [--aaaa <ip1>] [--txt <val>] [--owner <github>] [--desc <text>] [--push]
  npm run sub -- remove <label> [--domain <rootDomain>] [--push]`);
}

function gitCommitAndPush(filePath: string, message: string, shouldPush: boolean): void {
  execFileSync("git", ["add", filePath], { stdio: "inherit" });
  execFileSync("git", ["commit", "-m", message], { stdio: "inherit" });
  if (shouldPush) {
    execFileSync("git", ["push"], { stdio: "inherit" });
  }
}

export function runSubCli(argv = process.argv.slice(2)): number {
  const command = argv[0];
  if (!command || command === "--help" || command === "-h") {
    printUsage();
    return 0;
  }

  const config = loadConfig();
  const configuredDomains = getConfiguredRootDomains(config);

  if (command === "list") {
    const entries = loadDomainEntries(config.rootDomain);
    for (const entry of entries) {
      const domain = entry.rootDomain ?? config.rootDomain;
      const target =
        "CNAME" in entry.data.records
          ? `CNAME ${entry.data.records.CNAME}`
          : JSON.stringify(entry.data.records);
      console.log(
        `${entry.label}.${domain}\t@${entry.data.owner.github}\t${target}`,
      );
    }
    return 0;
  }

  const label = argv[1];
  if (!label) {
    printUsage();
    return 1;
  }

  const targetDomain = (getFlag(argv, "--domain") ?? config.rootDomain).toLowerCase();
  if (!configuredDomains.some((d) => d.domain.toLowerCase() === targetDomain)) {
    console.error(
      `Root domain "${targetDomain}" is not configured in config.json (available: ${configuredDomains.map((d) => d.domain).join(", ")}).`,
    );
    return 1;
  }

  const filename = `${label}.json`;
  filenameToLabel(filename);
  const relPath =
    targetDomain === config.rootDomain.toLowerCase() ? filename : `${targetDomain}/${filename}`;
  const filePath = join(process.cwd(), "domains", relPath);
  const shouldPush = argv.includes("--push");

  if (command === "remove") {
    if (!existsSync(filePath)) {
      console.error(`File not found: domains/${relPath}`);
      return 1;
    }
    const backup = readFileSync(filePath, "utf8");
    unlinkSync(filePath);
    const entries = loadDomainEntries(config.rootDomain);
    const compiled = compileMultiDomainRegistry(config, entries);
    if (compiled.errors.length > 0) {
      writeFileSync(filePath, backup, "utf8");
      console.error(`Validation failed after removal:\n- ${compiled.errors.join("\n- ")}`);
      return 1;
    }
    if (shouldPush) {
      gitCommitAndPush(filePath, `chore(dns): remove ${label}.${targetDomain}`, true);
    }
    console.log(`Removed ${label}.${targetDomain}.`);
    return 0;
  }

  if (command === "add") {
    const owner = getFlag(argv, "--owner") ?? config.admins[0]!;
    const description =
      getFlag(argv, "--desc") ?? `Subdomain ${label}.${targetDomain}`;
    const cname = getFlag(argv, "--cname");
    const aRaw = getFlag(argv, "--a");
    const aaaaRaw = getFlag(argv, "--aaaa");
    const txtValues = getMultiFlag(argv, "--txt");
    const vercelVerify = getMultiFlag(argv, "--vercel-verify");

    const records: SubdomainFile["records"] = cname
      ? { CNAME: cname }
      : {
          ...(aRaw ? { A: aRaw.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
          ...(aaaaRaw
            ? { AAAA: aaaaRaw.split(",").map((s) => s.trim()).filter(Boolean) }
            : {}),
          ...(txtValues.length > 0 ? { TXT: txtValues } : {}),
        };

    const candidate: SubdomainFile = {
      owner: { github: owner },
      description,
      records,
      ...(vercelVerify.length > 0 ? { vercelVerify } : {}),
    };

    const validated = parseSubdomainFile(candidate, label, targetDomain);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, `${JSON.stringify(validated, null, 2)}\n`, "utf8");

    const entries = loadDomainEntries(config.rootDomain);
    const compiled = compileMultiDomainRegistry(config, entries);
    if (compiled.errors.length > 0) {
      unlinkSync(filePath);
      console.error(`Validation failed:\n- ${compiled.errors.join("\n- ")}`);
      return 1;
    }

    if (shouldPush) {
      gitCommitAndPush(filePath, `feat(dns): add ${label}.${targetDomain}`, true);
    }
    console.log(`Created domains/${relPath} (${compiled.totalRecords} total records).`);
    return 0;
  }

  printUsage();
  return 1;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = runSubCli();
}
