import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadConfig, loadDomainEntries } from "./build-dns-manifest.js";
import { isMainModule } from "./lib/cli-utils.js";
import { compileRegistry } from "./lib/compiler.js";
import { getChangedFilesBetweenRefs, readDomainFilesAtRef } from "./lib/git-reader.js";
import { validatePullRequest } from "./lib/pr-validator.js";
import { filenameToLabel, parseSubdomainFile } from "./lib/schema.js";
import type { SubdomainEntry } from "./lib/types.js";

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

export function formatValidationMarkdown(
  rootDomain: string,
  result: ReturnType<typeof validatePullRequest>,
): string {
  const lines: string[] = [
    "<!-- fdomain-dns-preview -->",
    `### FDOMAIN DNS Validation — ${result.ok ? "Passed" : "Failed"}`,
    "",
    `- **Root domain**: \`${rootDomain}\``,
    `- **DNS record quota**: \`${result.recordCount} / ${result.maxRecords}\``,
    `- **Auto-merge**: ${result.autoMergeEligible ? "Eligible" : "Manual review"} (${result.autoMergeReason})`,
  ];

  if (result.errors.length > 0) {
    lines.push("", "#### Errors");
    for (const err of result.errors) {
      lines.push(`- ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push("", "#### Warnings");
    for (const warn of result.warnings) {
      lines.push(`- ${warn}`);
    }
  }

  lines.push("", "#### Planned DNS Record Changes");
  if (result.dnsDiff.added.length === 0 && result.dnsDiff.removed.length === 0) {
    lines.push("_No DNS record changes._");
  } else {
    lines.push("```diff");
    for (const r of result.dnsDiff.removed) {
      lines.push(`- ${r.label} ${r.type} ${r.value}`);
    }
    for (const r of result.dnsDiff.added) {
      lines.push(`+ ${r.label} ${r.type} ${r.value}`);
    }
    lines.push("```");
  }

  return `${lines.join("\n")}\n`;
}

function writeGithubOutputs(values: Record<string, string>): void {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (!outputPath) return;
  for (const [key, val] of Object.entries(values)) {
    appendFileSync(outputPath, `${key}=${val}\n`, "utf8");
  }
}

export function runValidateCli(argv = process.argv.slice(2)): number {
  const config = loadConfig();
  const baseRef = getFlag(argv, "--base") ?? process.env.BASE_SHA;
  const headRef = getFlag(argv, "--head") ?? process.env.HEAD_SHA;
  const prAuthor = getFlag(argv, "--author") ?? process.env.PR_AUTHOR;
  const jsonMode = argv.includes("--json");
  const markdownMode = argv.includes("--markdown");
  const emitManifestPath = getFlag(argv, "--emit-manifest");

  if (baseRef && headRef && prAuthor) {
    const changedFiles = getChangedFilesBetweenRefs(baseRef, headRef);
    const baseDomainFiles = readDomainFilesAtRef(baseRef);
    const headDomainFiles = readDomainFilesAtRef(headRef);

    const result = validatePullRequest({
      config,
      prAuthor,
      changedFiles,
      baseDomainFiles,
      headDomainFiles,
    });

    if (result.ok && emitManifestPath) {
      const headEntries: SubdomainEntry[] = headDomainFiles.map((f) => {
        const label = filenameToLabel(f.filename);
        return {
          label,
          filename: f.filename,
          data: parseSubdomainFile(JSON.parse(f.raw), label, config.rootDomain),
        };
      });
      const compiled = compileRegistry(config, headEntries);
      const absOut = resolve(emitManifestPath);
      mkdirSync(dirname(absOut), { recursive: true });
      writeFileSync(absOut, `${JSON.stringify(compiled.manifest, null, 2)}\n`, "utf8");
    }

    writeGithubOutputs({
      ok: String(result.ok),
      auto_merge_eligible: String(result.autoMergeEligible),
      record_count: String(result.recordCount),
    });

    if (jsonMode) {
      console.log(JSON.stringify(result, null, 2));
    } else if (markdownMode) {
      console.log(formatValidationMarkdown(config.rootDomain, result));
    } else {
      console.log(formatValidationMarkdown(config.rootDomain, result));
    }

    return result.ok ? 0 : 1;
  }

  const entries = loadDomainEntries(config.rootDomain);
  const compiled = compileRegistry(config, entries);

  for (const w of compiled.warnings) {
    console.warn(`WARN: ${w}`);
  }
  if (compiled.errors.length > 0) {
    for (const e of compiled.errors) {
      console.error(`ERROR: ${e}`);
    }
    return 1;
  }

  console.log(
    `Validated ${entries.length} subdomain file(s), ${compiled.manifest.records.length}/${config.limits.maxTotalRecords} DNS records.`,
  );
  return 0;
}

if (isMainModule(import.meta.url)) {
  process.exitCode = runValidateCli();
}
