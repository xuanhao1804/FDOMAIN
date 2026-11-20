import { execFileSync } from "node:child_process";
import type { ChangedFile, DomainRawFile } from "./pr-validator.js";

function runGit(args: string[], cwd = process.cwd()): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
}

export function tryGitShow(ref: string, filePath: string, cwd = process.cwd()): string | undefined {
  try {
    return runGit(["show", `${ref}:${filePath}`], cwd);
  } catch {
    return undefined;
  }
}

export function getChangedFilesBetweenRefs(
  baseRef: string,
  headRef: string,
  cwd = process.cwd(),
): ChangedFile[] {
  const output = runGit(
    ["diff", "--name-status", "--no-renames", `${baseRef}..${headRef}`],
    cwd,
  ).trim();

  if (!output) return [];

  const result: ChangedFile[] = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    const statusRaw = parts[0]?.trim();
    const path = parts[1]?.trim();
    if (!statusRaw || !path) continue;

    if (statusRaw !== "A" && statusRaw !== "M" && statusRaw !== "D") {
      throw new Error(`Unsupported git diff status "${statusRaw}" for "${path}"`);
    }

    const item: ChangedFile = { status: statusRaw, path };
    if (statusRaw === "M" || statusRaw === "D") {
      item.oldRaw = tryGitShow(baseRef, path, cwd);
    }
    if (statusRaw === "A" || statusRaw === "M") {
      item.newRaw = tryGitShow(headRef, path, cwd);
    }
    result.push(item);
  }

  return result;
}

export function readDomainFilesAtRef(
  ref: string,
  cwd = process.cwd(),
): DomainRawFile[] {
  const listOut = runGit(
    ["ls-tree", "-r", "--name-only", ref, "domains"],
    cwd,
  ).trim();

  if (!listOut) return [];

  const out: DomainRawFile[] = [];
  for (const fullPath of listOut.split(/\r?\n/)) {
    const trimmed = fullPath.trim();
    if (!trimmed.startsWith("domains/") || !trimmed.endsWith(".json")) continue;
    const filename = trimmed.slice("domains/".length);
    if (filename.split("/").length > 2) continue;
    const raw = tryGitShow(ref, trimmed, cwd);
    if (raw !== undefined) {
      out.push({ filename, raw });
    }
  }
  return out.sort((a, b) => a.filename.localeCompare(b.filename));
}
