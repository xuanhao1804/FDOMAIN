import type { CreatedProviderRecord, CreateProviderRecordInput } from "./types";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";
const zoneIdCache = new Map<string, string>();

interface CfRecordRaw {
  id: string;
  name: string;
  type: string;
  content: string;
  ttl: number;
}

interface CfEnvelope<T> {
  success: boolean;
  errors?: Array<{ code: number; message: string }>;
  result: T;
}

export function isCloudflareConfigured(): boolean {
  return Boolean(process.env.CLOUDFLARE_API_TOKEN?.trim());
}

function getCloudflareToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  if (!token) {
    throw new Error("CLOUDFLARE_API_TOKEN is not configured on the server.");
  }
  return token;
}

function envZoneOverride(domain: string): string | undefined {
  const snake = domain.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return (
    process.env[`CLOUDFLARE_ZONE_ID_${snake}`]?.trim() ||
    process.env.CLOUDFLARE_ZONE_ID?.trim() ||
    undefined
  );
}

function formatCfError<T>(res: Response, body?: CfEnvelope<T>): string {
  const msg = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
  return `Cloudflare API error (${msg})`;
}

async function resolveZoneId(
  domain: string,
  token: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const key = domain.toLowerCase();
  const envOverride = envZoneOverride(key);
  if (envOverride) return envOverride;
  const cached = zoneIdCache.get(key);
  if (cached) return cached;

  const res = await fetchImpl(
    `${CLOUDFLARE_API_BASE}/zones?name=${encodeURIComponent(key)}&status=active`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  const body = (await res.json()) as CfEnvelope<Array<{ id: string; name: string }>>;
  if (!res.ok || !body.success || !body.result[0]?.id) {
    throw new Error(
      body.result?.length === 0
        ? `Cloudflare zone "${key}" not found or active on this API token.`
        : formatCfError(res, body),
    );
  }

  zoneIdCache.set(key, body.result[0].id);
  return body.result[0].id;
}

function toHostLabel(fqdn: string, domain: string): string {
  const clean = fqdn.toLowerCase().replace(/\.$/, "");
  const root = domain.toLowerCase();
  if (clean === root) return "@";
  const suffix = `.${root}`;
  return clean.endsWith(suffix) ? clean.slice(0, -suffix.length) : clean;
}

export async function listCloudflareRecords(
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedProviderRecord[]> {
  const token = getCloudflareToken();
  const zoneId = await resolveZoneId(domain, token, fetchImpl);
  const res = await fetchImpl(
    `${CLOUDFLARE_API_BASE}/zones/${encodeURIComponent(zoneId)}/dns_records?per_page=500`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  const body = (await res.json()) as CfEnvelope<CfRecordRaw[]>;
  if (!res.ok || !body.success) {
    throw new Error(formatCfError(res, body));
  }

  return body.result.map((rec) => {
    const host = toHostLabel(rec.name, domain);
    return {
      id: rec.id,
      host,
      fqdn: host === "@" ? domain : `${host}.${domain}`,
      type: rec.type.toUpperCase(),
      value: rec.content,
      ttl: rec.ttl,
    };
  });
}

export async function createCloudflareRecord(
  domain: string,
  input: CreateProviderRecordInput,
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedProviderRecord> {
  const token = getCloudflareToken();
  const zoneId = await resolveZoneId(domain, token, fetchImpl);
  const name = input.host === "@" ? domain : `${input.host}.${domain}`;

  const res = await fetchImpl(
    `${CLOUDFLARE_API_BASE}/zones/${encodeURIComponent(zoneId)}/dns_records`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      // Strictly DNS-only per FDOMAIN security policy (never orange-cloud proxied)
      body: JSON.stringify({
        type: input.type,
        name,
        content: input.value,
        ttl: input.ttl ?? 1,
        proxied: false,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  const body = (await res.json()) as CfEnvelope<CfRecordRaw>;
  if (!res.ok || !body.success || !body.result) {
    throw new Error(formatCfError(res, body));
  }

  const host = toHostLabel(body.result.name, domain);
  return {
    id: body.result.id,
    host,
    fqdn: host === "@" ? domain : `${host}.${domain}`,
    type: body.result.type.toUpperCase(),
    value: body.result.content,
    ttl: body.result.ttl,
  };
}

export async function deleteCloudflareRecord(
  domain: string,
  recordId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const token = getCloudflareToken();
  const zoneId = await resolveZoneId(domain, token, fetchImpl);
  const res = await fetchImpl(
    `${CLOUDFLARE_API_BASE}/zones/${encodeURIComponent(zoneId)}/dns_records/${encodeURIComponent(recordId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  const body = (await res.json()) as CfEnvelope<{ id: string }>;
  if (!res.ok || !body.success) {
    throw new Error(formatCfError(res, body));
  }
}
