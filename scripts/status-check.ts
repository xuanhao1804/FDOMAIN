import { resolve4, resolve6 } from "node:dns/promises";
import { writeFileSync } from "node:fs";
import { loadConfig, loadDomainEntries } from "./build-dns-manifest.js";
import { isMainModule } from "./lib/cli-utils.js";
import { normalizeCnameTarget } from "./lib/schema.js";
import {
  classifyHttpResponse,
  formatDeadSubdomainIssueBody,
  type StatusReport,
  type SubdomainStatusItem,
} from "./lib/status-check.js";
import type { SubdomainEntry } from "./lib/types.js";

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

async function isHostnameNxdomain(hostname: string): Promise<boolean> {
  const clean = normalizeCnameTarget(hostname);
  let sawNxdomain = false;

  try {
    await resolve4(clean);
    return false;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND") sawNxdomain = true;
  }

  try {
    await resolve6(clean);
    return false;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOTFOUND" && sawNxdomain) return true;
  }

  return false;
}

async function probeEntry(
  entry: SubdomainEntry,
  rootDomain: string,
): Promise<SubdomainStatusItem> {
  const fqdn = `${entry.label}.${rootDomain}`;
  const checkedAt = new Date().toISOString();
  const owner = entry.data.owner.github;

  const isWebSubdomain =
    "CNAME" in entry.data.records ||
    Boolean(entry.data.records.A?.length) ||
    Boolean(entry.data.records.AAAA?.length);

  if (!isWebSubdomain) {
    return {
      label: entry.label,
      fqdn,
      owner,
      status: "unknown",
      reason: "TXT-only record (not probed via HTTP)",
      checkedAt,
    };
  }

  if ("CNAME" in entry.data.records) {
    const targetDead = await isHostnameNxdomain(entry.data.records.CNAME);
    if (targetDead) {
      return {
        label: entry.label,
        fqdn,
        owner,
        status: "dead",
        reason: `CNAME target "${entry.data.records.CNAME}" returned NXDOMAIN`,
        checkedAt,
      };
    }
  }

  try {
    const response = await fetch(`https://${fqdn}/`, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "user-agent": "FDOMAIN-HealthCheck/1.0",
      },
    });

    const headers: Record<string, string | undefined> = {};
    response.headers.forEach((val, key) => {
      headers[key.toLowerCase()] = val;
    });

    const body = (await response.text()).slice(0, 16_384);
    const classified = classifyHttpResponse(response.status, headers, body);

    return {
      label: entry.label,
      fqdn,
      owner,
      status: classified.status,
      httpStatus: response.status,
      reason: classified.reason,
      checkedAt,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      label: entry.label,
      fqdn,
      owner,
      status: "warn",
      reason: `HTTPS request failed: ${msg}`,
      checkedAt,
    };
  }
}

async function syncDeadSubdomainIssue(
  repository: string,
  deadItems: SubdomainStatusItem[],
  generatedAt: string,
): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn("GITHUB_TOKEN not set; skipping issue notification.");
    return;
  }

  const headers = {
    authorization: `Bearer ${token}`,
    accept: "application/vnd.github+json",
    "content-type": "application/json",
    "x-github-api-version": "2022-11-28",
  };

  const baseApi = `https://api.github.com/repos/${repository}`;

  // Ensure label exists (ignore 422 if already created)
  await fetch(`${baseApi}/labels`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      name: "dead-subdomain",
      color: "b60205",
      description: "Automated alert for dangling/dead subdomains at takeover risk",
    }),
  });

  const existingRes = await fetch(
    `${baseApi}/issues?state=open&labels=dead-subdomain&per_page=10`,
    { headers },
  );
  if (!existingRes.ok) {
    throw new Error(`Failed querying GitHub issues: HTTP ${existingRes.status}`);
  }
  const existingIssues = (await existingRes.json()) as Array<{ number: number }>;
  const existing = existingIssues[0];

  if (deadItems.length === 0) {
    if (existing) {
      await fetch(`${baseApi}/issues/${existing.number}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          body: `All subdomains passed health checks as of \`${generatedAt}\`. Closing alert.`,
        }),
      });
      await fetch(`${baseApi}/issues/${existing.number}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ state: "closed", state_reason: "completed" }),
      });
    }
    return;
  }

  const body = formatDeadSubdomainIssueBody(deadItems, generatedAt);
  const title = `[dead-subdomain] ${deadItems.length} subdomain(s) need attention`;

  if (existing) {
    await fetch(`${baseApi}/issues/${existing.number}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ title, body }),
    });
  } else {
    await fetch(`${baseApi}/issues`, {
      method: "POST",
      headers,
      body: JSON.stringify({ title, body, labels: ["dead-subdomain"] }),
    });
  }
}

export async function runStatusCheckCli(argv = process.argv.slice(2)): Promise<number> {
  const outPath = getFlag(argv, "--out") ?? "status.json";
  const reportIssues = argv.includes("--report-issues");

  const config = loadConfig();
  const entries = loadDomainEntries(config.rootDomain);
  const generatedAt = new Date().toISOString();

  const results = await Promise.all(
    entries.map((entry) => probeEntry(entry, entry.rootDomain ?? config.rootDomain)),
  );

  const report: StatusReport = {
    generatedAt,
    rootDomain: config.rootDomain,
    entries: {},
  };

  for (const item of results) {
    report.entries[item.fqdn] = item;
  }

  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const deadItems = results.filter((r) => r.status === "dead");
  const warnItems = results.filter((r) => r.status === "warn");
  console.log(
    `Checked ${results.length} subdomain(s): ${results.length - deadItems.length - warnItems.length} live/other, ${warnItems.length} warn, ${deadItems.length} dead.`,
  );

  if (reportIssues) {
    await syncDeadSubdomainIssue(config.repository, deadItems, generatedAt);
  }

  return 0;
}

if (isMainModule(import.meta.url)) {
  runStatusCheckCli().then(
    (code) => {
      process.exitCode = code;
    },
    (err) => {
      console.error(err);
      process.exitCode = 1;
    },
  );
}
