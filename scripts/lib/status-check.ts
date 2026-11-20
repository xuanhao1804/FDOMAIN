export type SubdomainHealth = "live" | "warn" | "dead" | "unknown";

export interface SubdomainStatusItem {
  label: string;
  fqdn: string;
  owner: string;
  status: SubdomainHealth;
  httpStatus?: number;
  reason: string;
  checkedAt: string;
}

export interface StatusReport {
  generatedAt: string;
  rootDomain: string;
  entries: Record<string, SubdomainStatusItem>;
}

export function classifyHttpResponse(
  status: number,
  headers: Record<string, string | undefined>,
  body: string,
): { status: SubdomainHealth; reason: string } {
  const lowerHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v !== undefined) lowerHeaders[k.toLowerCase()] = v;
  }

  if (
    lowerHeaders["x-vercel-error"] === "DEPLOYMENT_NOT_FOUND" ||
    body.includes("DEPLOYMENT_NOT_FOUND")
  ) {
    return { status: "dead", reason: "Vercel DEPLOYMENT_NOT_FOUND (potential takeover)" };
  }

  if (body.includes("There isn't a GitHub Pages site here")) {
    return { status: "dead", reason: "Unclaimed GitHub Pages site (potential takeover)" };
  }

  if (status === 404 && body.includes("Not Found - Request ID")) {
    return { status: "dead", reason: "Unclaimed Netlify site (potential takeover)" };
  }

  if (status >= 200 && status < 400) {
    return { status: "live", reason: `HTTP ${status}` };
  }

  return { status: "warn", reason: `HTTP ${status}` };
}

export function formatDeadSubdomainIssueBody(
  deadItems: SubdomainStatusItem[],
  generatedAt: string,
): string {
  const lines: string[] = [
    "Automated daily health scan detected subdomain(s) pointing to dangling targets (`dead`).",
    "Please redeploy your site or remove/update the corresponding file in `domains/` to prevent subdomain takeover.",
    "",
    `Last checked: \`${generatedAt}\``,
    "",
    "| Subdomain | Owner | Reason | Action |",
    "| --- | --- | --- | --- |",
  ];

  for (const item of deadItems) {
    lines.push(
      `| \`${item.fqdn}\` | @${item.owner} | ${item.reason} | Update or delete \`domains/${item.label}.json\` |`,
    );
  }

  lines.push(
    "",
    "_Note: FDOMAIN never auto-deletes subdomains; an admin may clean up unresolved entries after ~7 days._",
  );

  return `${lines.join("\n")}\n`;
}
