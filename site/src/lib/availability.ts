import {
  getHardLockReason,
  isReservedSubdomainLabel,
  isValidSubdomainLabel,
} from "./dns-rules";
import { getDomainCapability } from "./dns-providers";
import { getCachedDomainHosts, setCachedDomainHosts } from "./dns-providers/cache";
import { listCloudflareRecords } from "./dns-providers/cloudflare";
import { lookupLiveDns } from "./dns-providers/doh";
import { listNamecomRecords } from "./dns-providers/namecom";
import type { DomainCapability } from "./dns-providers/types";
import type { SiteRegistryPayload, SiteRootDomainMeta } from "./registry";

export type AvailabilityStatus =
  | "available"
  | "taken"
  | "reserved"
  | "protected"
  | "invalid"
  | "unverified";

export type AvailabilitySource =
  | "validation"
  | "registry"
  | "live-api"
  | "doh"
  | "doh-fallback"
  | "doh-error";

export interface AvailabilityPayload {
  available: boolean;
  status: AvailabilityStatus;
  fqdn: string;
  domain: string;
  label: string;
  canOverride: boolean;
  source: AvailabilitySource;
  providerMode: DomainCapability["mode"];
}

export type AvailabilityCheckOutcome =
  | { ok: true; data: AvailabilityPayload }
  | { ok: false; httpStatus: 502; error: string };

async function probeDohExists(
  fqdn: string,
  fetchImpl: typeof fetch,
): Promise<{ found: boolean; allFailed: boolean }> {
  const results = await Promise.allSettled([
    lookupLiveDns(fqdn, "CNAME", fetchImpl),
    lookupLiveDns(fqdn, "A", fetchImpl),
  ]);

  let anySucceeded = false;
  for (const res of results) {
    if (res.status === "fulfilled") {
      anySucceeded = true;
      if (res.value.status === "found" && res.value.answers.length > 0) {
        return { found: true, allFailed: false };
      }
    }
  }
  return { found: false, allFailed: !anySucceeded };
}

async function fetchAuthoritativeHostSet(
  domainCfg: SiteRootDomainMeta,
  fetchImpl: typeof fetch,
): Promise<Set<string>> {
  const cached = getCachedDomainHosts(domainCfg.domain);
  if (cached) {
    return cached;
  }

  const raw =
    domainCfg.dnsProvider === "namecom"
      ? await listNamecomRecords(domainCfg.domain, fetchImpl)
      : await listCloudflareRecords(domainCfg.domain, fetchImpl);

  const hosts = new Set<string>();
  for (const rec of raw) {
    hosts.add(rec.host.trim().toLowerCase());
  }
  setCachedDomainHosts(domainCfg.domain, hosts);
  return hosts;
}

export interface CheckAvailabilityInput {
  domainCfg: SiteRootDomainMeta;
  rawLabel: string;
  registryData: Pick<SiteRegistryPayload, "entries" | "reservedLabels" | "unmanaged">;
  isAdmin: boolean;
  fetchImpl?: typeof fetch;
}

/**
 * Deterministic server-side availability evaluation for Home's check-on-submit flow.
 * Never leaks private record values, targets, or redacted infrastructure hosts to public callers.
 */
export async function checkSubdomainAvailability({
  domainCfg,
  rawLabel,
  registryData,
  isAdmin,
  fetchImpl = fetch,
}: CheckAvailabilityInput): Promise<AvailabilityCheckOutcome> {
  const label = rawLabel.trim().toLowerCase();
  const domain = domainCfg.domain.toLowerCase();
  const fqdn = label ? `${label}.${domain}` : domain;
  const providerMode = getDomainCapability(domainCfg).mode;

  // 1. Validate subdomain label syntax & total FQDN length
  if (!isValidSubdomainLabel(label) || fqdn.length > 253) {
    return {
      ok: true,
      data: {
        available: false,
        status: "invalid",
        fqdn,
        domain,
        label,
        canOverride: false,
        source: "validation",
        providerMode,
      },
    };
  }

  // 2. Check hard-locked / protected unmanaged rules
  const hardReason = getHardLockReason(
    label,
    "CNAME",
    "availability-check.example",
    registryData.unmanaged,
  );
  if (hardReason !== null) {
    return {
      ok: true,
      data: {
        available: false,
        status: "protected",
        fqdn,
        domain,
        label,
        canOverride: false,
        source: "validation",
        providerMode,
      },
    };
  }

  const reserved = isReservedSubdomainLabel(label, registryData.reservedLabels);

  // 3. Public security short-circuit: do NOT probe live provider/DoH for reserved labels
  //    when unauthenticated (prevents host-existence oracle on redacted system hosts).
  if (reserved && !isAdmin) {
    return {
      ok: true,
      data: {
        available: false,
        status: "reserved",
        fqdn,
        domain,
        label,
        canOverride: false,
        source: "validation",
        providerMode,
      },
    };
  }

  // 4. Check Git-tracked registry entries
  const inRegistry = registryData.entries.some(
    (entry) =>
      entry.rootDomain.toLowerCase() === domain && entry.label.toLowerCase() === label,
  );
  if (inRegistry) {
    return {
      ok: true,
      data: {
        available: false,
        status: "taken",
        fqdn,
        domain,
        label,
        canOverride: false,
        source: "registry",
        providerMode,
      },
    };
  }

  // 5. Check live provider API (when auto-ready) or DoH (when manual-copy / auto-needs-env)
  let source: AvailabilitySource = "doh";
  let unverified = false;

  if (providerMode === "auto-ready") {
    try {
      const hosts = await fetchAuthoritativeHostSet(domainCfg, fetchImpl);
      source = "live-api";
      if (hosts.has(label)) {
        return {
          ok: true,
          data: {
            available: false,
            status: "taken",
            fqdn,
            domain,
            label,
            canOverride: false,
            source: "live-api",
            providerMode,
          },
        };
      }
    } catch {
      // Provider API transient failure: fall back to public DoH before giving up
      const dohFallback = await probeDohExists(fqdn, fetchImpl);
      if (dohFallback.allFailed) {
        return {
          ok: false,
          httpStatus: 502,
          error: "Unable to verify subdomain availability right now. Please try again shortly.",
        };
      }
      if (dohFallback.found) {
        return {
          ok: true,
          data: {
            available: false,
            status: "taken",
            fqdn,
            domain,
            label,
            canOverride: false,
            source: "doh",
            providerMode,
          },
        };
      }
      source = "doh-fallback";
      unverified = true;
    }
  } else {
    const doh = await probeDohExists(fqdn, fetchImpl);
    if (doh.found) {
      return {
        ok: true,
        data: {
          available: false,
          status: "taken",
          fqdn,
          domain,
          label,
          canOverride: false,
          source: "doh",
          providerMode,
        },
      };
    }
    if (doh.allFailed) {
      source = "doh-error";
      unverified = true;
    } else {
      source = "doh";
    }
  }

  // 6. Admin reserved check (runs after live existence so already-taken reserved names report "taken")
  if (reserved && isAdmin) {
    return {
      ok: true,
      data: {
        available: false,
        status: "reserved",
        fqdn,
        domain,
        label,
        canOverride: true,
        source: "validation",
        providerMode,
      },
    };
  }

  // 7. Available (or unverified if fallback / DoH failed on manual domain)
  return {
    ok: true,
    data: {
      available: true,
      status: unverified ? "unverified" : "available",
      fqdn,
      domain,
      label,
      canOverride: false,
      source,
      providerMode,
    },
  };
}
