import { isIPv4, isIPv6 } from "node:net";
import { z } from "zod";
import type { RegistryConfig, RootDomainConfig, SubdomainFile } from "./types.js";

export const FILENAME_REGEX =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.json$/;

export const LABEL_REGEX =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

export const EXTRA_KEY_REGEX = /^_[a-z0-9-]+$/;

export const GITHUB_USERNAME_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/;

const HOSTNAME_LABEL_REGEX = /^[a-zA-Z0-9_]([a-zA-Z0-9_-]{0,61}[a-zA-Z0-9_])?$/;

export function isValidHostnameTarget(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes("://") || trimmed.includes("/") || trimmed.includes("*")) {
    return false;
  }
  const withoutTrailingDot = trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
  if (withoutTrailingDot.length === 0 || withoutTrailingDot.length > 253) {
    return false;
  }
  if (isIPv4(withoutTrailingDot) || isIPv6(withoutTrailingDot)) {
    return false;
  }
  const labels = withoutTrailingDot.split(".");
  if (labels.length < 2) {
    return false;
  }
  return labels.every((part) => HOSTNAME_LABEL_REGEX.test(part));
}

export function normalizeCnameTarget(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  return trimmed.endsWith(".") ? trimmed.slice(0, -1) : trimmed;
}

export function withTrailingDot(hostname: string): string {
  const normalized = normalizeCnameTarget(hostname);
  return `${normalized}.`;
}

export function filenameToLabel(filename: string): string {
  if (!FILENAME_REGEX.test(filename)) {
    throw new Error(
      `Invalid domain filename "${filename}". Expected lowercase DNS labels ending in .json (no underscores).`,
    );
  }
  return filename.slice(0, -".json".length);
}

/** Parse either `<label>.json` (default domain) or `<rootDomain>/<label>.json`. */
export function parseDomainRelativePath(
  relativeFilename: string,
  defaultRootDomain: string,
): { rootDomain: string; label: string; filename: string } {
  const normalized = relativeFilename.replace(/\\/g, "/");
  const slashIndex = normalized.indexOf("/");
  if (slashIndex === -1) {
    return {
      rootDomain: defaultRootDomain.toLowerCase(),
      label: filenameToLabel(normalized),
      filename: normalized,
    };
  }

  const domainPart = normalized.slice(0, slashIndex).toLowerCase();
  const filePart = normalized.slice(slashIndex + 1);
  if (filePart.includes("/") || !isValidHostnameTarget(domainPart)) {
    throw new Error(
      `Invalid domain file path "domains/${normalized}". Expected domains/<label>.json or domains/<rootDomain>/<label>.json.`,
    );
  }
  return {
    rootDomain: domainPart,
    label: filenameToLabel(filePart),
    filename: normalized,
  };
}

export function getConfiguredRootDomains(config: RegistryConfig): RootDomainConfig[] {
  if (config.rootDomains && config.rootDomains.length > 0) {
    return config.rootDomains.map((item) => ({
      ...item,
      domain: item.domain.toLowerCase(),
    }));
  }
  return [
    {
      domain: config.rootDomain.toLowerCase(),
      registrar: "Cloudflare",
      dnsProvider: "cloudflare-gitops",
      note: "Default GitOps Cloudflare zone",
    },
  ];
}

const GithubUsernameSchema = z
  .string()
  .trim()
  .regex(GITHUB_USERNAME_REGEX, "Invalid GitHub username format");

const CnameTargetSchema = z
  .string()
  .trim()
  .refine(isValidHostnameTarget, "CNAME target must be a valid FQDN hostname (not an IP or URL)");

const Ipv4Schema = z
  .string()
  .trim()
  .refine((value) => isIPv4(value), "Invalid IPv4 address");

const Ipv6Schema = z
  .string()
  .trim()
  .refine((value) => isIPv6(value), "Invalid IPv6 address");

const TxtValueSchema = z.string().min(1, "TXT record cannot be empty").max(2048);

const CnameOnlyRecordsSchema = z
  .object({
    CNAME: CnameTargetSchema,
  })
  .strict();

const NonCnameRecordsSchema = z
  .object({
    A: z.array(Ipv4Schema).min(1).optional(),
    AAAA: z.array(Ipv6Schema).min(1).optional(),
    TXT: z.array(TxtValueSchema).min(1).optional(),
  })
  .strict()
  .refine(
    (val) => Boolean(val.A?.length || val.AAAA?.length || val.TXT?.length),
    "records must include at least one A, AAAA, or TXT entry",
  );

const SubdomainRecordsSchema = z.union([CnameOnlyRecordsSchema, NonCnameRecordsSchema]);

const ExtraRecordSchema = z.union([
  z.object({ CNAME: CnameTargetSchema }).strict(),
  z.object({ TXT: z.array(TxtValueSchema).min(1) }).strict(),
]);

const DnsProviderTypeSchema = z.enum([
  "namecom",
  "cloudflare-api",
  "cloudflare-gitops",
  "namecheap-manual",
]);

const RootDomainConfigSchema = z
  .object({
    domain: z.string().trim().toLowerCase().refine(isValidHostnameTarget, "Invalid rootDomains[].domain"),
    registrar: z.string().trim().min(1).max(60),
    dnsProvider: DnsProviderTypeSchema,
    note: z.string().trim().max(200).optional(),
  })
  .strict();

export const ConfigSchema = z
  .object({
    rootDomain: z.string().trim().refine(isValidHostnameTarget, "Invalid rootDomain"),
    rootDomains: z.array(RootDomainConfigSchema).min(1).optional(),
    repository: z.string().trim().regex(/^[^/\s]+\/[^/\s]+$/, "Expected owner/repo"),
    lookupSubdomain: z.string().trim().regex(LABEL_REGEX),
    admins: z.array(GithubUsernameSchema).min(1),
    trusted: z.array(GithubUsernameSchema),
    reservedLabels: z.array(z.string().trim().min(1)),
    unmanaged: z.array(
      z
        .object({
          label: z.string().trim().min(1),
          types: z.string().trim().min(1),
          target: z.string().trim().min(1).optional(),
        })
        .strict(),
    ),
    limits: z
      .object({
        maxTotalRecords: z.number().int().positive(),
        warnAtRecords: z.number().int().positive(),
        maxDeletionsPerPush: z.number().int().nonnegative(),
      })
      .strict()
      .refine((l) => l.warnAtRecords <= l.maxTotalRecords, {
        message: "warnAtRecords must be <= maxTotalRecords",
      }),
  })
  .strict()
  .superRefine((cfg, ctx) => {
    if (!cfg.rootDomains) return;
    const seen = new Set<string>();
    for (const item of cfg.rootDomains) {
      const lower = item.domain.toLowerCase();
      if (seen.has(lower)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rootDomains"],
          message: `Duplicate rootDomains entry "${item.domain}"`,
        });
      }
      seen.add(lower);
    }
    if (!seen.has(cfg.rootDomain.toLowerCase())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rootDomain"],
        message: `rootDomain "${cfg.rootDomain}" must also appear in rootDomains[]`,
      });
    }
  });

export function createSubdomainSchema(label: string, rootDomain: string) {
  const expectedPrefix = `vc-domain-verify=${label}.${rootDomain},`;

  return z
    .object({
      owner: z
        .object({
          github: GithubUsernameSchema,
          contact: z.string().trim().min(1).max(200).optional(),
        })
        .strict(),
      description: z.string().trim().min(1).max(240),
      records: SubdomainRecordsSchema,
      vercelVerify: z
        .array(
          z
            .string()
            .trim()
            .refine(
              (value) =>
                value.startsWith(expectedPrefix) && value.length > expectedPrefix.length,
              `Each vercelVerify entry must start with "${expectedPrefix}" followed by a token`,
            ),
        )
        .min(1)
        .optional(),
      extra: z
        .record(z.string(), ExtraRecordSchema)
        .superRefine((obj, ctx) => {
          for (const key of Object.keys(obj)) {
            if (!EXTRA_KEY_REGEX.test(key) || key.length > 63) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [key],
                message: `Extra record key "${key}" must match ^_[a-z0-9-]+$ and be <= 63 chars`,
              });
            }
            const fullName = `${key}.${label}.${rootDomain}`;
            if (fullName.length > 253) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: [key],
                message: `Extra record FQDN "${fullName}" exceeds 253 characters`,
              });
            }
          }
        })
        .optional(),
    })
    .strict();
}

export function parseConfig(raw: unknown): RegistryConfig {
  return ConfigSchema.parse(raw);
}

export function parseSubdomainFile(
  raw: unknown,
  label: string,
  rootDomain: string,
): SubdomainFile {
  if (!LABEL_REGEX.test(label)) {
    throw new Error(`Invalid subdomain label "${label}"`);
  }
  const fqdn = `${label}.${rootDomain}`;
  if (fqdn.length > 253) {
    throw new Error(`FQDN "${fqdn}" exceeds 253 characters`);
  }
  return createSubdomainSchema(label, rootDomain).parse(raw);
}
