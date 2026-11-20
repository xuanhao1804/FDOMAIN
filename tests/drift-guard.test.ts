import { describe, expect, it } from "vitest";
import { evaluateDriftGuard, parseCorrectionLine } from "../scripts/lib/drift-guard.js";
import type { RegistryConfig } from "../scripts/lib/types.js";

const CONFIG: RegistryConfig = {
  rootDomain: "harrylee.dev",
  repository: "xuanhao1804/FDOMAIN",
  lookupSubdomain: "domains",
  admins: ["xuanhao1804"],
  trusted: [],
  reservedLabels: ["www", "admin", "domains"],
  unmanaged: [{ label: "@", types: "*" }],
  limits: {
    maxTotalRecords: 100,
    warnAtRecords: 80,
    maxDeletionsPerPush: 2,
  },
};

function jsonFile(owner: string, extra?: Record<string, unknown>) {
  return JSON.stringify({
    owner: { github: owner },
    description: "Site",
    records: { CNAME: "cname.vercel-dns.com" },
    ...extra,
  });
}

describe("parseCorrectionLine", () => {
  it("parses CREATE, MODIFY, and DELETE lines", () => {
    expect(
      parseCorrectionLine(
        "+ CREATE alice.harrylee.dev CNAME cname.vercel-dns.com. ttl=300",
      ),
    ).toEqual({
      action: "CREATE",
      fqdn: "alice.harrylee.dev",
      recordType: "CNAME",
      rawLine: "+ CREATE alice.harrylee.dev CNAME cname.vercel-dns.com. ttl=300",
    });

    expect(
      parseCorrectionLine(
        "± MODIFY blog.harrylee.dev CNAME (old.com. ttl=300) -> (new.com. ttl=300)",
      ).action,
    ).toBe("MODIFY");

    expect(
      parseCorrectionLine('- DELETE manual.harrylee.dev TXT "hi" ttl=300').action,
    ).toBe("DELETE");
  });
});

describe("evaluateDriftGuard", () => {
  it("allows CREATEs and DELETEs/MODIFYs for labels managed in prev or curr commit", () => {
    const res = evaluateDriftGuard({
      config: CONFIG,
      reportEntries: [
        {
          domain: "harrylee.dev",
          corrections: 3,
          correction_details: [
            "+ CREATE newapp.harrylee.dev CNAME cname.vercel-dns.com. ttl=300",
            "- DELETE oldapp.harrylee.dev CNAME cname.vercel-dns.com. ttl=300",
            "- DELETE _acme-challenge.oldapp.harrylee.dev TXT \"tok\" ttl=300",
          ],
        },
      ],
      prevDomainFiles: [
        {
          filename: "oldapp.json",
          raw: jsonFile("alice", {
            extra: { "_acme-challenge": { TXT: ["tok"] } },
          }),
        },
      ],
      currDomainFiles: [{ filename: "newapp.json", raw: jsonFile("alice") }],
    });

    expect(res.ok).toBe(true);
    expect(res.deletionsCount).toBe(2);
    expect(res.creationsCount).toBe(1);
    expect(res.violations).toEqual([]);
  });

  it("handles managed _vercel TXT deletions while blocking unknown _vercel TXT deletions", () => {
    const allowed = evaluateDriftGuard({
      config: CONFIG,
      reportEntries: [
        {
          domain: "harrylee.dev",
          corrections: 1,
          correction_details: [
            '- DELETE _vercel.harrylee.dev TXT "vc-domain-verify=alice.harrylee.dev,tok1" ttl=300',
          ],
        },
      ],
      prevDomainFiles: [
        {
          filename: "alice.json",
          raw: jsonFile("alice", {
            vercelVerify: ["vc-domain-verify=alice.harrylee.dev,tok1"],
          }),
        },
      ],
      currDomainFiles: [],
    });
    expect(allowed.ok).toBe(true);

    const blocked = evaluateDriftGuard({
      config: CONFIG,
      reportEntries: [
        {
          domain: "harrylee.dev",
          corrections: 1,
          correction_details: [
            '- DELETE _vercel.harrylee.dev TXT "vc-domain-verify=other.harrylee.dev,secret" ttl=300',
          ],
        },
      ],
      prevDomainFiles: [],
      currDomainFiles: [],
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.violations[0]).toMatch(/unmanaged _vercel TXT/);
  });

  it("blocks deleting or modifying unmanaged or apex records", () => {
    const res = evaluateDriftGuard({
      config: CONFIG,
      reportEntries: [
        {
          domain: "harrylee.dev",
          corrections: 2,
          correction_details: [
            "- DELETE dashboard-test.harrylee.dev A 1.2.3.4 ttl=300",
            "± MODIFY harrylee.dev MX (10 mail.com.) -> (20 mail2.com.)",
          ],
        },
      ],
      prevDomainFiles: [],
      currDomainFiles: [],
    });

    expect(res.ok).toBe(false);
    expect(res.violations).toHaveLength(2);
    expect(res.violations[0]).toMatch(/unmanaged label "dashboard-test"/);
    expect(res.violations[1]).toMatch(/unmanaged label "@"/);
  });

  it("blocks when deletions exceed maxDeletionsPerPush unless force is true", () => {
    const input = {
      config: CONFIG,
      reportEntries: [
        {
          domain: "harrylee.dev",
          corrections: 3,
          correction_details: [
            "- DELETE a.harrylee.dev CNAME x.com. ttl=300",
            "- DELETE b.harrylee.dev CNAME x.com. ttl=300",
            "- DELETE c.harrylee.dev CNAME x.com. ttl=300",
          ],
        },
      ],
      prevDomainFiles: [
        { filename: "a.json", raw: jsonFile("alice") },
        { filename: "b.json", raw: jsonFile("alice") },
        { filename: "c.json", raw: jsonFile("alice") },
      ],
      currDomainFiles: [],
    };

    const blocked = evaluateDriftGuard(input);
    expect(blocked.ok).toBe(false);
    expect(blocked.violations[0]).toMatch(/exceeds maxDeletionsPerPush/);

    const forced = evaluateDriftGuard({ ...input, force: true });
    expect(forced.ok).toBe(true);
  });
});
