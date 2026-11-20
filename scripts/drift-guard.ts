import { readFileSync } from "node:fs";
import { loadConfig } from "./build-dns-manifest.js";
import { isMainModule } from "./lib/cli-utils.js";
import { evaluateDriftGuard, type DnscontrolReportEntry } from "./lib/drift-guard.js";
import { readDomainFilesAtRef } from "./lib/git-reader.js";

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  const reportPath = getFlag(argv, "--report") ?? "/tmp/dnscontrol-preview.json";
  const prevRef = getFlag(argv, "--prev") ?? "HEAD~1";
  const currRef = getFlag(argv, "--curr") ?? "HEAD";
  const force = argv.includes("--force") || process.env.FORCE_DEPLOY === "true";

  const config = loadConfig();
  const reportEntries = JSON.parse(
    readFileSync(reportPath, "utf8"),
  ) as DnscontrolReportEntry[];

  let prevDomainFiles = [] as ReturnType<typeof readDomainFilesAtRef>;
  try {
    prevDomainFiles = readDomainFilesAtRef(prevRef);
  } catch {
    prevDomainFiles = [];
  }
  const currDomainFiles = readDomainFilesAtRef(currRef);

  const result = evaluateDriftGuard({
    config,
    reportEntries,
    prevDomainFiles,
    currDomainFiles,
    force,
  });

  console.log(
    `Drift guard: +${result.creationsCount} create, ~${result.modificationsCount} modify, -${result.deletionsCount} delete (force=${force}).`,
  );

  if (result.violations.length > 0) {
    console.error("Drift guard violations detected:");
    for (const v of result.violations) {
      console.error(`- ${v}`);
    }
    if (!force) {
      process.exitCode = 1;
    }
  }
}
