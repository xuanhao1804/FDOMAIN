import { describe, expect, it } from "vitest";
import { compileRegistry } from "../scripts/lib/compiler.js";
import { filenameToLabel, parseSubdomainFile } from "../scripts/lib/schema.js";
import type { RegistryConfig, SubdomainEntry } from "../scripts/lib/types.js";

const BASE_CONFIG: RegistryConfig = {
  rootDomain: "harrylee.dev",
  repository: "xuanhao1804/FDOMAIN",
  lookupSubdomain: "domains",
  admins: ["xuanhao1804"],
  trusted: ["alice-gh"],
  reservedLabels: ["www", "admin", "domains", "_vercel"],
  unmanaged: [
    { label: "@", types: "*" },
    { label: "www", types: "*" },
    { label: "_vercel", types: "TXT", target: "vc-domain-verify=harrylee.dev,*" },
  ],
  limits: {
    maxTotalRecords: 10,
    warnAtRecords: 8,
    maxDeletionsPerPush: 5,
  },
};

function makeEntry(
  label: string,
  owner: string,
  overrides: Record<string, unknown> = {},
): SubdomainEntry {
  const raw = {
    owner: { github: owner },
    description: `${label} site`,
    records: { CNAME: "cname.vercel-dns.com" },
    ...overrides,
  };
  const data = parseSubdomainFile(raw, label, BASE_CONFIG.rootDomain);
  return { label, filename: `${label}.json`, data };
}

describe("filenameToLabel & parseSubdomainFile", () => {
  it("accepts valid single and nested labels", () => {
    expect(filenameToLabel("blog.json")).toBe("blog");
    expect(filenameToLabel("api.v2-beta.json")).toBe("api.v2-beta");
  });

  it("rejects uppercase, underscores, or invalid labels", () => {
    expect(() => filenameToLabel("Blog.json")).toThrow();
    expect(() => filenameToLabel("_vercel.json")).toThrow();
    expect(() => filenameToLabel("my_app.json")).toThrow();
    expect(() => filenameToLabel("-bad.json")).toThrow();
  });

  it("rejects unknown fields such as proxied", () => {
    expect(() =>
      parseSubdomainFile(
        {
          owner: { github: "alice-gh" },
          description: "Site",
          records: { CNAME: "cname.vercel-dns.com" },
          proxied: true,
        },
        "alice",
        "harrylee.dev",
      ),
    ).toThrow();
  });

  it("enforces exclusive CNAME vs A/AAAA/TXT", () => {
    expect(() =>
      parseSubdomainFile(
        {
          owner: { github: "alice-gh" },
          description: "Mixed",
          records: { CNAME: "cname.vercel-dns.com", TXT: ["hello"] },
        },
        "alice",
        "harrylee.dev",
      ),
    ).toThrow();

    const parsed = parseSubdomainFile(
      {
        owner: { github: "alice-gh" },
        description: "VPS",
        records: { A: ["203.0.113.10"], AAAA: ["2001:db8::1"], TXT: ["v=1"] },
      },
      "vps",
      "harrylee.dev",
    );
    expect(parsed.records).toEqual({
      A: ["203.0.113.10"],
      AAAA: ["2001:db8::1"],
      TXT: ["v=1"],
    });
  });

  it("validates vercelVerify prefix against label and rootDomain", () => {
    expect(() =>
      parseSubdomainFile(
        {
          owner: { github: "alice-gh" },
          description: "Hijack attempt",
          records: { CNAME: "cname.vercel-dns.com" },
          vercelVerify: ["vc-domain-verify=bob.harrylee.dev,secret"],
        },
        "alice",
        "harrylee.dev",
      ),
    ).toThrow();

    const ok = parseSubdomainFile(
      {
        owner: { github: "alice-gh" },
        description: "Valid",
        records: { CNAME: "cname.vercel-dns.com" },
        vercelVerify: ["vc-domain-verify=alice.harrylee.dev,token123"],
      },
      "alice",
      "harrylee.dev",
    );
    expect(ok.vercelVerify).toEqual(["vc-domain-verify=alice.harrylee.dev,token123"]);
  });

  it("validates extra underscore verification records", () => {
    const ok = parseSubdomainFile(
      {
        owner: { github: "alice-gh" },
        description: "GH Pages + ACME",
        records: { CNAME: "alice-gh.github.io" },
        extra: {
          "_github-pages-challenge-alice-gh": { TXT: ["challenge-123"] },
          "_acme-challenge": { CNAME: "acme.example.net" },
        },
      },
      "alice",
      "harrylee.dev",
    );
    expect(ok.extra?.["_acme-challenge"]).toEqual({ CNAME: "acme.example.net" });

    expect(() =>
      parseSubdomainFile(
        {
          owner: { github: "alice-gh" },
          description: "Bad extra key",
          records: { CNAME: "alice-gh.github.io" },
          extra: {
            "not-underscore": { TXT: ["nope"] },
          },
        },
        "alice",
        "harrylee.dev",
      ),
    ).toThrow();
  });
});

describe("compileRegistry", () => {
  it("expands CNAME with trailing dot, vercelVerify, and extra records", () => {
    const alice = makeEntry("alice", "Alice-GH", {
      vercelVerify: ["vc-domain-verify=alice.harrylee.dev,abc"],
      extra: {
        "_acme-challenge": { TXT: ["xyz"] },
      },
    });
    const res = compileRegistry(BASE_CONFIG, [alice]);
    expect(res.errors).toEqual([]);
    expect(res.manifest.records).toEqual([
      {
        label: "_acme-challenge.alice",
        type: "TXT",
        value: "xyz",
        sourceLabel: "alice",
      },
      {
        label: "_vercel",
        type: "TXT",
        value: "vc-domain-verify=alice.harrylee.dev,abc",
        sourceLabel: "alice",
      },
      {
        label: "alice",
        type: "CNAME",
        value: "cname.vercel-dns.com.",
        sourceLabel: "alice",
      },
    ]);
  });

  it("blocks reserved labels for non-admins but allows admins", () => {
    const nonAdmin = makeEntry("domains", "alice-gh");
    expect(compileRegistry(BASE_CONFIG, [nonAdmin]).errors.length).toBeGreaterThan(0);

    const admin = makeEntry("domains", "XuanHao1804");
    expect(compileRegistry(BASE_CONFIG, [admin]).errors).toEqual([]);
  });

  it("enforces parent existence and case-insensitive owner match for nested labels", () => {
    const orphan = makeEntry("api.blog", "alice-gh");
    expect(compileRegistry(BASE_CONFIG, [orphan]).errors[0]).toMatch(/parent file/);

    const parent = makeEntry("blog", "alice-gh");
    const wrongOwner = makeEntry("api.blog", "bob-gh");
    expect(compileRegistry(BASE_CONFIG, [parent, wrongOwner]).errors[0]).toMatch(
      /same owner/,
    );

    const sameOwnerDiffCase = makeEntry("api.blog", "Alice-GH");
    expect(compileRegistry(BASE_CONFIG, [parent, sameOwnerDiffCase]).errors).toEqual([]);
  });

  it("enforces record quota limits and warnings", () => {
    const many = makeEntry("vps", "alice-gh", {
      records: {
        A: ["203.0.113.1", "203.0.113.2", "203.0.113.3", "203.0.113.4"],
        TXT: ["t1", "t2", "t3", "t4"],
      },
    });
    const warnRes = compileRegistry(BASE_CONFIG, [many]);
    expect(warnRes.errors).toEqual([]);
    expect(warnRes.warnings.length).toBe(1);

    const tooMany = makeEntry("vps2", "alice-gh", {
      records: { A: ["203.0.113.5", "203.0.113.6", "203.0.113.7"] },
    });
    const errRes = compileRegistry(BASE_CONFIG, [many, tooMany]);
    expect(errRes.errors[0]).toMatch(/exceeds limit/);
  });
});
