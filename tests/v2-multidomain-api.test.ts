import { afterEach, describe, expect, it, vi } from "vitest";
import { compileMultiDomainRegistry } from "../scripts/lib/compiler.js";
import { validatePullRequest } from "../scripts/lib/pr-validator.js";
import { parseConfig, parseDomainRelativePath, parseSubdomainFile } from "../scripts/lib/schema.js";
import { buildSitePayload } from "../scripts/export-site-data.js";
import type { RegistryConfig, SubdomainEntry } from "../scripts/lib/types.js";
import {
  assertSameOrigin,
  createSessionToken,
  verifyAdminPassword,
  verifySessionToken,
} from "../site/src/lib/auth.js";
import {
  createProviderRecords,
  fetchDomainRecords,
  removeProviderRecord,
} from "../site/src/lib/dns-providers/index.js";
import {
  isFqdnWithinConfiguredDomains,
  lookupLiveDns,
} from "../site/src/lib/dns-providers/doh.js";
import {
  buildPreviewDnsRows,
  getHardLockReason,
  isValidSubdomainLabel,
} from "../site/src/lib/dns-rules.js";
import { checkSubdomainAvailability } from "../site/src/lib/availability.js";
import { invalidateDomainCache } from "../site/src/lib/dns-providers/cache.js";

const MULTI_CONFIG: RegistryConfig = {
  rootDomain: "harrylee.dev",
  rootDomains: [
    {
      domain: "harrylee.dev",
      registrar: "Name.com",
      dnsProvider: "namecom",
    },
    {
      domain: "vinamuse.store",
      registrar: "Namecheap",
      dnsProvider: "namecheap-manual",
    },
  ],
  repository: "xuanhao1804/FDOMAIN",
  lookupSubdomain: "domains",
  admins: ["xuanhao1804"],
  trusted: ["alice-gh"],
  reservedLabels: ["domains", "admin", "status"],
  unmanaged: [
    { label: "@", types: "*" },
    { label: "www", types: "*" },
    { label: "mail", types: "*" },
    { label: "_vercel", types: "TXT", target: "vc-domain-verify=*" },
  ],
  limits: {
    maxTotalRecords: 180,
    warnAtRecords: 150,
    maxDeletionsPerPush: 10,
  },
};

afterEach(() => {
  delete process.env.ADMIN_PASSWORD;
  delete process.env.SESSION_SECRET;
  delete process.env.NAMECOM_USERNAME;
  delete process.env.NAMECOM_TOKEN;
  delete process.env.CLOUDFLARE_API_TOKEN;
  delete process.env.CLOUDFLARE_ZONE_ID;
  invalidateDomainCache("harrylee.dev");
  invalidateDomainCache("vinamuse.store");
});

describe("Multi-domain config & compiler", () => {
  it("parses rootDomains config and scoped domain paths", () => {
    const cfg = parseConfig(MULTI_CONFIG);
    expect(cfg.rootDomains).toHaveLength(2);

    expect(parseDomainRelativePath("blog.json", "harrylee.dev")).toEqual({
      rootDomain: "harrylee.dev",
      label: "blog",
      filename: "blog.json",
    });

    expect(parseDomainRelativePath("vinamuse.store/shop.json", "harrylee.dev")).toEqual({
      rootDomain: "vinamuse.store",
      label: "shop",
      filename: "vinamuse.store/shop.json",
    });
  });

  it("compiles same subdomain label across distinct root domains without collision", () => {
    const entries: SubdomainEntry[] = [
      {
        label: "blog",
        rootDomain: "harrylee.dev",
        filename: "blog.json",
        data: parseSubdomainFile(
          {
            owner: { github: "xuanhao1804" },
            description: "Harry blog",
            records: { CNAME: "cname.vercel-dns.com" },
          },
          "blog",
          "harrylee.dev",
        ),
      },
      {
        label: "blog",
        rootDomain: "vinamuse.store",
        filename: "vinamuse.store/blog.json",
        data: parseSubdomainFile(
          {
            owner: { github: "alice-gh" },
            description: "Vinamuse blog",
            records: { CNAME: "cname.vercel-dns.com" },
          },
          "blog",
          "vinamuse.store",
        ),
      },
    ];

    const compiled = compileMultiDomainRegistry(MULTI_CONFIG, entries);
    expect(compiled.errors).toEqual([]);
    expect(compiled.totalRecords).toBe(2);

    const payload = buildSitePayload(MULTI_CONFIG, entries, null);
    expect(payload.rootDomains).toHaveLength(2);
    expect(payload.entries.map((e) => e.fqdn)).toEqual([
      "blog.harrylee.dev",
      "blog.vinamuse.store",
    ]);
  });

  it("validates scoped multi-domain PRs independently", () => {
    const rawShop = JSON.stringify({
      owner: { github: "alice-gh" },
      description: "Shop app",
      records: { CNAME: "cname.vercel-dns.com" },
    });

    const res = validatePullRequest({
      config: MULTI_CONFIG,
      prAuthor: "alice-gh",
      changedFiles: [
        { status: "A", path: "domains/vinamuse.store/shop.json", newRaw: rawShop },
      ],
      baseDomainFiles: [],
      headDomainFiles: [{ filename: "vinamuse.store/shop.json", raw: rawShop }],
    });

    expect(res.ok).toBe(true);
    expect(res.autoMergeEligible).toBe(true);
  });
});

describe("Auth & CSRF origin guards", () => {
  it("verifies password, HMAC session expiry, and SameOrigin", () => {
    process.env.ADMIN_PASSWORD = "super-secret-password";
    process.env.SESSION_SECRET = "0123456789abcdef0123456789abcdef";

    expect(verifyAdminPassword("super-secret-password")).toBe(true);
    expect(verifyAdminPassword("wrong")).toBe(false);

    const token = createSessionToken(1_000)!;
    expect(verifySessionToken(token, 1_100)).toBe(true);
    expect(verifySessionToken(token, 1_000 + 60 * 60 * 24 * 8)).toBe(false);
    expect(verifySessionToken(`${token}x`, 1_100)).toBe(false);

    const okReq = new Request("https://fdomain.vercel.app/api/dns/records", {
      method: "POST",
      headers: {
        host: "fdomain.vercel.app",
        origin: "https://fdomain.vercel.app",
      },
    });
    const evilReq = new Request("https://fdomain.vercel.app/api/dns/records", {
      method: "POST",
      headers: {
        host: "fdomain.vercel.app",
        origin: "https://evil.example",
      },
    });
    expect(assertSameOrigin(okReq)).toBe(true);
    expect(assertSameOrigin(evilReq)).toBe(false);
  });
});

describe("DNS rules & preview rows", () => {
  it("validates labels, hard-locks unmanaged records, and builds preview rows", () => {
    expect(isValidSubdomainLabel("app")).toBe(true);
    expect(isValidSubdomainLabel("api.v2")).toBe(true);
    expect(isValidSubdomainLabel("-bad")).toBe(false);

    expect(getHardLockReason("@", "A", "1.2.3.4", MULTI_CONFIG.unmanaged!)).not.toBeNull();
    expect(getHardLockReason("www", "CNAME", "x.com", MULTI_CONFIG.unmanaged!)).not.toBeNull();
    expect(getHardLockReason("mail", "MX", "mx.x.com", MULTI_CONFIG.unmanaged!)).not.toBeNull();
    expect(getHardLockReason("app", "CNAME", "cname.vercel-dns.com", MULTI_CONFIG.unmanaged!)).toBeNull();

    const rows = buildPreviewDnsRows({
      rootDomain: "vinamuse.store",
      dnsProvider: "namecheap-manual",
      label: "shop",
      recordType: "CNAME",
      target: "cname.vercel-dns.com.",
      vercelVerify: "vc-domain-verify=shop.vinamuse.store,abc",
    });

    expect(rows).toEqual([
      {
        id: "primary",
        host: "shop",
        fqdn: "shop.vinamuse.store",
        type: "CNAME",
        value: "cname.vercel-dns.com",
        ttl: 300,
        purpose: "Primary endpoint",
      },
      {
        id: "vercel-verify",
        host: "_vercel",
        fqdn: "_vercel.vinamuse.store",
        type: "TXT",
        value: "vc-domain-verify=shop.vinamuse.store,abc",
        ttl: 300,
        purpose: "Vercel ownership verification",
      },
    ]);
  });
});

describe("DNS provider adapters & guards", () => {
  it("redacts protected/TXT records publicly and enforces reserved + unmanaged guards on Name.com", async () => {
    process.env.NAMECOM_USERNAME = "tester";
    process.env.NAMECOM_TOKEN = "tok-123";

    const mockFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/records?perPage=500") && (!init?.method || init.method === "GET")) {
        return new Response(
          JSON.stringify({
            records: [
              { id: 1, host: "", fqdn: "harrylee.dev", type: "A", answer: "1.1.1.1", ttl: 300 },
              { id: 2, host: "www", fqdn: "www.harrylee.dev", type: "CNAME", answer: "harrylee.dev", ttl: 300 },
              { id: 3, host: "app", fqdn: "app.harrylee.dev", type: "CNAME", answer: "cname.vercel-dns.com", ttl: 300 },
              { id: 4, host: "_vercel", fqdn: "_vercel.harrylee.dev", type: "TXT", answer: "vc-domain-verify=secret", ttl: 300 },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/records") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { host: string; type: string; answer: string; ttl: number };
        return new Response(
          JSON.stringify({
            id: 99,
            host: body.host,
            fqdn: `${body.host}.harrylee.dev`,
            type: body.type,
            answer: body.answer,
            ttl: body.ttl,
          }),
          { status: 200 },
        );
      }
      if (url.endsWith("/records/3") && init?.method === "DELETE") {
        return new Response("{}", { status: 200 });
      }
      return new Response("Not found", { status: 404 });
    }) as unknown as typeof fetch;

    const harryDomain = {
      ...MULTI_CONFIG.rootDomains![0]!,
      gitRecordCount: 0,
    };
    const publicRes = await fetchDomainRecords(
      harryDomain,
      MULTI_CONFIG.unmanaged,
      MULTI_CONFIG.reservedLabels,
      false,
      mockFetch,
    );
    expect(publicRes.records.map((r) => r.fqdn)).toEqual(["app.harrylee.dev"]);
    expect(publicRes.records[0]?.id).toBeNull();

    const adminRes = await fetchDomainRecords(
      harryDomain,
      MULTI_CONFIG.unmanaged,
      MULTI_CONFIG.reservedLabels,
      true,
      mockFetch,
    );
    expect(adminRes.records).toHaveLength(4);
    expect(adminRes.records.find((r) => r.host === "@")?.canDelete).toBe(false);
    expect(adminRes.records.find((r) => r.host === "app")?.canDelete).toBe(true);

    // Hard block apex/www deletion even if admin calls removeProviderRecord directly
    await expect(
      removeProviderRecord(
        harryDomain,
        "2",
        MULTI_CONFIG.unmanaged,
        MULTI_CONFIG.reservedLabels,
        true,
        mockFetch,
      ),
    ).rejects.toThrow(/Cannot delete protected record/);

    // Reserved creation requires explicit allowReserved=true
    await expect(
      createProviderRecords(
        harryDomain,
        [{ host: "admin", type: "CNAME", value: "cname.vercel-dns.com" }],
        MULTI_CONFIG.unmanaged,
        MULTI_CONFIG.reservedLabels,
        false,
        mockFetch,
      ),
    ).rejects.toThrow(/reserved label/);

    const created = await createProviderRecords(
      harryDomain,
      [
        { host: "admin", type: "CNAME", value: "cname.vercel-dns.com" },
        { host: "_vercel", type: "TXT", value: "vc-domain-verify=admin.harrylee.dev,tok" },
      ],
      MULTI_CONFIG.unmanaged,
      MULTI_CONFIG.reservedLabels,
      true,
      mockFetch,
    );
    expect(created).toHaveLength(2);
  });

  it("forces proxied=false on Cloudflare record creation", async () => {
    process.env.CLOUDFLARE_API_TOKEN = "cf-test";
    process.env.CLOUDFLARE_ZONE_ID = "zone-123";

    let sentBody: Record<string, unknown> | null = null;
    const mockFetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sentBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          success: true,
          result: {
            id: "cf-rec-1",
            name: "shop.vinamuse.store",
            type: "CNAME",
            content: "cname.vercel-dns.com",
            ttl: 1,
          },
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const res = await createProviderRecords(
      {
        domain: "vinamuse.store",
        registrar: "Cloudflare",
        dnsProvider: "cloudflare-api",
        gitRecordCount: 0,
      },
      [{ host: "shop", type: "CNAME", value: "cname.vercel-dns.com" }],
      MULTI_CONFIG.unmanaged,
      MULTI_CONFIG.reservedLabels,
      false,
      mockFetch,
    );

    expect(sentBody).toMatchObject({ proxied: false, name: "shop.vinamuse.store" });
    expect(res[0]?.fqdn).toBe("shop.vinamuse.store");
  });

  it("restricts DoH lookup to configured domains and falls back cleanly", async () => {
    expect(isFqdnWithinConfiguredDomains("app.vinamuse.store", ["harrylee.dev", "vinamuse.store"])).toBe(true);
    expect(isFqdnWithinConfiguredDomains("evil.com", ["harrylee.dev", "vinamuse.store"])).toBe(false);

    const mockFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("cloudflare-dns.com")) {
        return new Response("error", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          Status: 0,
          Answer: [{ name: "blog.harrylee.dev.", type: 5, TTL: 300, data: "cname.vercel-dns.com." }],
        }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const doh = await lookupLiveDns("blog.harrylee.dev", "CNAME", mockFetch);
    expect(doh.resolver).toBe("google-doh");
    expect(doh.status).toBe("found");
    expect(doh.answers[0]?.data).toBe("cname.vercel-dns.com");
  });
});

describe("Subdomain availability check engine", () => {
  const NAMECOM_DOMAIN = {
    domain: "harrylee.dev",
    registrar: "Name.com",
    dnsProvider: "namecom" as const,
    gitRecordCount: 0,
  };
  const NAMECHEAP_DOMAIN = {
    domain: "vinamuse.store",
    registrar: "Namecheap",
    dnsProvider: "namecheap-manual" as const,
    gitRecordCount: 0,
  };
  const EMPTY_REGISTRY = {
    entries: [],
    reservedLabels: MULTI_CONFIG.reservedLabels,
    unmanaged: MULTI_CONFIG.unmanaged,
  };

  it("rejects invalid syntax and protected unmanaged labels before any network call", async () => {
    const mockFetch = vi.fn() as unknown as typeof fetch;

    const invalid = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "-bad label-",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: mockFetch,
    });
    expect(invalid).toEqual({
      ok: true,
      data: expect.objectContaining({ available: false, status: "invalid", source: "validation" }),
    });

    const protectedRes = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "www",
      registryData: EMPTY_REGISTRY,
      isAdmin: true,
      fetchImpl: mockFetch,
    });
    expect(protectedRes).toEqual({
      ok: true,
      data: expect.objectContaining({ available: false, status: "protected", source: "validation" }),
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("short-circuits public callers on reserved labels without probing upstream APIs", async () => {
    process.env.NAMECOM_USERNAME = "harry";
    process.env.NAMECOM_TOKEN = "tok";
    const mockFetch = vi.fn() as unknown as typeof fetch;

    const res = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "admin",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: mockFetch,
    });

    expect(res).toEqual({
      ok: true,
      data: expect.objectContaining({
        available: false,
        status: "reserved",
        canOverride: false,
        source: "validation",
      }),
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("checks live Name.com records for auto-ready domains, caches hosts, and handles Admin reserved override", async () => {
    process.env.NAMECOM_USERNAME = "harry";
    process.env.NAMECOM_TOKEN = "tok";

    const mockFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          records: [
            { id: 1, domainName: "harrylee.dev", host: "blog", fqdn: "blog.harrylee.dev.", type: "CNAME", answer: "cname.vercel-dns.com", ttl: 300 },
            { id: 2, domainName: "harrylee.dev", host: "status", fqdn: "status.harrylee.dev.", type: "CNAME", answer: "status.example.com", ttl: 300 },
          ],
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;

    const taken = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "blog",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: mockFetch,
    });
    expect(taken).toEqual({
      ok: true,
      data: expect.objectContaining({ available: false, status: "taken", source: "live-api" }),
    });

    const free = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "portfolio",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: mockFetch,
    });
    expect(free).toEqual({
      ok: true,
      data: expect.objectContaining({ available: true, status: "available", source: "live-api" }),
    });
    // Second call used the 30s server host-set cache
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Admin checking reserved label that ALREADY exists gets "taken"
    const adminReservedTaken = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "status",
      registryData: EMPTY_REGISTRY,
      isAdmin: true,
      fetchImpl: mockFetch,
    });
    expect(adminReservedTaken).toEqual({
      ok: true,
      data: expect.objectContaining({ available: false, status: "taken", canOverride: false }),
    });

    // Admin checking unused reserved label gets "reserved" with canOverride: true
    const adminReservedFree = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "admin",
      registryData: EMPTY_REGISTRY,
      isAdmin: true,
      fetchImpl: mockFetch,
    });
    expect(adminReservedFree).toEqual({
      ok: true,
      data: expect.objectContaining({ available: false, status: "reserved", canOverride: true }),
    });
  });

  it("falls back to DoH when Name.com API fails, and returns 502 if both API and DoH fail", async () => {
    process.env.NAMECOM_USERNAME = "harry";
    process.env.NAMECOM_TOKEN = "tok";

    const fallbackFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("api.name.com")) {
        return new Response("upstream error", { status: 503 });
      }
      return new Response(JSON.stringify({ Status: 3 }), { status: 200 });
    }) as unknown as typeof fetch;

    const fallbackRes = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "fresh",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: fallbackFetch,
    });
    expect(fallbackRes).toEqual({
      ok: true,
      data: expect.objectContaining({
        available: true,
        status: "unverified",
        source: "doh-fallback",
      }),
    });

    const totalFailFetch = vi.fn(async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
    const failed = await checkSubdomainAvailability({
      domainCfg: NAMECOM_DOMAIN,
      rawLabel: "fresh",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: totalFailFetch,
    });
    expect(failed).toEqual({
      ok: false,
      httpStatus: 502,
      error: expect.any(String),
    });
  });

  it("uses DoH for manual Namecheap domains and degrades to unverified if DoH fails", async () => {
    const dohFoundFetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("type=CNAME")) {
        return new Response(
          JSON.stringify({
            Status: 0,
            Answer: [{ name: "shop.vinamuse.store.", type: 5, TTL: 300, data: "cname.vercel-dns.com." }],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ Status: 3 }), { status: 200 });
    }) as unknown as typeof fetch;

    const taken = await checkSubdomainAvailability({
      domainCfg: NAMECHEAP_DOMAIN,
      rawLabel: "shop",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: dohFoundFetch,
    });
    expect(taken).toEqual({
      ok: true,
      data: expect.objectContaining({ available: false, status: "taken", source: "doh" }),
    });

    const dohDownFetch = vi.fn(async () => new Response("err", { status: 500 })) as unknown as typeof fetch;
    const unverified = await checkSubdomainAvailability({
      domainCfg: NAMECHEAP_DOMAIN,
      rawLabel: "new-shop",
      registryData: EMPTY_REGISTRY,
      isAdmin: false,
      fetchImpl: dohDownFetch,
    });
    expect(unverified).toEqual({
      ok: true,
      data: expect.objectContaining({ available: true, status: "unverified", source: "doh-error" }),
    });
  });
});
