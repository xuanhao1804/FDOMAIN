import { loadConfig } from "./build-dns-manifest.js";
import { isMainModule } from "./lib/cli-utils.js";
import { getChangedFilesBetweenRefs, readDomainFilesAtRef } from "./lib/git-reader.js";
import { validatePullRequest } from "./lib/pr-validator.js";
import { formatValidationMarkdown } from "./validate.js";

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

if (isMainModule(import.meta.url)) {
  const argv = process.argv.slice(2);
  const baseRef = getFlag(argv, "--base") ?? process.env.BASE_SHA;
  const headRef = getFlag(argv, "--head") ?? process.env.HEAD_SHA;
  const prAuthor = getFlag(argv, "--author") ?? process.env.PR_AUTHOR;

  if (!baseRef || !headRef || !prAuthor) {
    console.error("Usage: tsx scripts/diff-summary.ts --base <ref> --head <ref> --author <github>");
    process.exit(1);
  }

  const config = loadConfig();
  const result = validatePullRequest({
    config,
    prAuthor,
    changedFiles: getChangedFilesBetweenRefs(baseRef, headRef),
    baseDomainFiles: readDomainFilesAtRef(baseRef),
    headDomainFiles: readDomainFilesAtRef(headRef),
  });

  console.log(formatValidationMarkdown(config.rootDomain, result));
}
