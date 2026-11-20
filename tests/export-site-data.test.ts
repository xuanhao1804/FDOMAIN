import { describe, expect, it } from "vitest";
import { buildSitePayload } from "../scripts/export-site-data.js";
import type { StatusReport } from "../scripts/lib/status-check.js";
import type { RegistryConfig, SubdomainEntry } from "../scripts/lib/types.js";

const CONFIG: RegistryConfig = {
  rootDomain: "harrylee.dev",
  repository: "xuanhao1804/FDOMAIN",
  lookupSubdomain: "domains",
  admins: ["xuanhao1804"],
  trusted: [],
  reservedLabels: ["domains"],
  unmanaged: [{ label: "@", types: "*" }],
  limits: {
    maxTotalRecords: 100,
    warnAtRecords: 80,
    maxDeletionsPerPush: 5,
  },
};

describe("buildSitePayload", () => {
  it("strips owner.contact and merges health status report", () => {
    const entries: SubdomainEntry[] = [
      {
        label: "alice",
        filename: "alice.json",
        data: {
          owner: { github: "alice-gh", contact: "private@example.com" },
          description: "Alice site",
          records: { CNAME: "cname.vercel-dns.com" },
        },
      },
      {
        label: "domains",
        filename: "domains.json",
        data: {
          owner: { github: "xuanhao1804" },
          description: "Portal",
          records: { CNAME: "xuanhao1804.github.io" },
        },
      },
    ];

    const statusReport: StatusReport = {
      generatedAt: "2026-11-20T06:00:00.000Z",
      rootDomain: "harrylee.dev",
      entries: {
        alice: {
          label: "alice",
          fqdn: "alice.harrylee.dev",
          owner: "alice-gh",
          status: "live",
          httpStatus: 200,
          reason: "HTTP 200",
          checkedAt: "2026-11-20T06:00:00.000Z",
        },
      },
    };

    const payload = buildSitePayload(CONFIG, entries, statusReport);
    expect(payload.entries).toHaveLength(2);
    expect(JSON.stringify(payload)).not.toContain("private@example.com");

    const alice = payload.entries.find((e) => e.label === "alice");
    expect(alice?.health.status).toBe("live");
    expect(alice?.editUrl).toBe(
      "https://github.com/xuanhao1804/FDOMAIN/edit/main/domains/alice.json",
    );

    const domains = payload.entries.find((e) => e.label === "domains");
    expect(domains?.health.status).toBe("unknown");
  });
});
