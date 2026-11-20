import { describe, expect, it } from "vitest";
import { validatePullRequest } from "../scripts/lib/pr-validator.js";
import type { RegistryConfig } from "../scripts/lib/types.js";

const CONFIG: RegistryConfig = {
  rootDomain: "harrylee.dev",
  repository: "xuanhao1804/FDOMAIN",
  lookupSubdomain: "domains",
  admins: ["xuanhao1804"],
  trusted: ["alice-gh"],
  reservedLabels: ["www", "admin", "domains", "_vercel"],
  unmanaged: [{ label: "@", types: "*" }],
  limits: {
    maxTotalRecords: 50,
    warnAtRecords: 40,
    maxDeletionsPerPush: 5,
  },
};

function domainJson(owner: string, cname = "cname.vercel-dns.com"): string {
  return JSON.stringify({
    owner: { github: owner },
    description: "Test site",
    records: { CNAME: cname },
  });
}

describe("validatePullRequest", () => {
  it("allows trusted user adding their own non-reserved subdomain and marks auto-merge eligible", () => {
    const newAlice = domainJson("Alice-GH");
    const res = validatePullRequest({
      config: CONFIG,
      prAuthor: "alice-gh",
      changedFiles: [{ status: "A", path: "domains/alice.json", newRaw: newAlice }],
      baseDomainFiles: [{ filename: "domains.json", raw: domainJson("xuanhao1804") }],
      headDomainFiles: [
        { filename: "domains.json", raw: domainJson("xuanhao1804") },
        { filename: "alice.json", raw: newAlice },
      ],
    });

    expect(res.ok).toBe(true);
    expect(res.autoMergeEligible).toBe(true);
    expect(res.dnsDiff.added).toEqual([
      {
        label: "alice",
        type: "CNAME",
        value: "cname.vercel-dns.com.",
        sourceLabel: "alice",
      },
    ]);
  });

  it("requires manual review for non-trusted contributor even when valid", () => {
    const newBob = domainJson("bob-gh");
    const res = validatePullRequest({
      config: CONFIG,
      prAuthor: "bob-gh",
      changedFiles: [{ status: "A", path: "domains/bob.json", newRaw: newBob }],
      baseDomainFiles: [],
      headDomainFiles: [{ filename: "bob.json", raw: newBob }],
    });

    expect(res.ok).toBe(true);
    expect(res.autoMergeEligible).toBe(false);
    expect(res.autoMergeReason).toMatch(/manual/i);
  });

  it("blocks non-admin from editing scripts or config", () => {
    const res = validatePullRequest({
      config: CONFIG,
      prAuthor: "alice-gh",
      changedFiles: [{ status: "M", path: "scripts/validate.ts" }],
      baseDomainFiles: [],
      headDomainFiles: [],
    });

    expect(res.ok).toBe(false);
    expect(res.autoMergeEligible).toBe(false);
    expect(res.errors[0]).toMatch(/cannot modify "scripts\/validate.ts"/);
  });

  it("blocks modifying another user's subdomain or transferring ownership", () => {
    const bobOld = domainJson("bob-gh");
    const aliceHijack = domainJson("alice-gh");

    const modifyOther = validatePullRequest({
      config: CONFIG,
      prAuthor: "alice-gh",
      changedFiles: [
        { status: "M", path: "domains/bob.json", oldRaw: bobOld, newRaw: aliceHijack },
      ],
      baseDomainFiles: [{ filename: "bob.json", raw: bobOld }],
      headDomainFiles: [{ filename: "bob.json", raw: aliceHijack }],
    });
    expect(modifyOther.ok).toBe(false);
    expect(modifyOther.errors.some((e) => /existing owner is "bob-gh"/.test(e))).toBe(true);

    const transferAttempt = validatePullRequest({
      config: CONFIG,
      prAuthor: "alice-gh",
      changedFiles: [
        {
          status: "M",
          path: "domains/alice.json",
          oldRaw: domainJson("alice-gh"),
          newRaw: domainJson("bob-gh"),
        },
      ],
      baseDomainFiles: [{ filename: "alice.json", raw: domainJson("alice-gh") }],
      headDomainFiles: [{ filename: "alice.json", raw: domainJson("bob-gh") }],
    });
    expect(transferAttempt.ok).toBe(false);
    expect(transferAttempt.errors.some((e) => /PR author must match/.test(e))).toBe(true);
  });

  it("fails when deleting parent file while child nested subdomain remains", () => {
    const parent = domainJson("alice-gh");
    const child = domainJson("alice-gh");

    const res = validatePullRequest({
      config: CONFIG,
      prAuthor: "alice-gh",
      changedFiles: [{ status: "D", path: "domains/blog.json", oldRaw: parent }],
      baseDomainFiles: [
        { filename: "blog.json", raw: parent },
        { filename: "api.blog.json", raw: child },
      ],
      headDomainFiles: [{ filename: "api.blog.json", raw: child }],
    });

    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => /requires parent file/.test(e))).toBe(true);
  });

  it("blocks non-admin from claiming a reserved subdomain", () => {
    const reserved = domainJson("alice-gh");
    const res = validatePullRequest({
      config: CONFIG,
      prAuthor: "alice-gh",
      changedFiles: [{ status: "A", path: "domains/admin.json", newRaw: reserved }],
      baseDomainFiles: [],
      headDomainFiles: [{ filename: "admin.json", raw: reserved }],
    });

    expect(res.ok).toBe(false);
    expect(res.errors[0]).toMatch(/reserved/);
  });

  it("allows admin to modify non-domain files or transfer ownership (without auto-merge outside domains/)", () => {
    const res = validatePullRequest({
      config: CONFIG,
      prAuthor: "xuanhao1804",
      changedFiles: [
        { status: "M", path: "config.json" },
        {
          status: "M",
          path: "domains/alice.json",
          oldRaw: domainJson("alice-gh"),
          newRaw: domainJson("bob-gh"),
        },
      ],
      baseDomainFiles: [{ filename: "alice.json", raw: domainJson("alice-gh") }],
      headDomainFiles: [{ filename: "alice.json", raw: domainJson("bob-gh") }],
    });

    expect(res.ok).toBe(true);
    expect(res.autoMergeEligible).toBe(false);
  });
});
