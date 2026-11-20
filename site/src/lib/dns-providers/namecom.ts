import type { CreatedProviderRecord, CreateProviderRecordInput } from "./types";

interface NamecomRawRecord {
  id: number | string;
  domainName?: string;
  host?: string;
  fqdn?: string;
  type: string;
  answer: string;
  ttl?: number;
}

function getNamecomCredentials(): { username: string; token: string; apiBase: string } {
  const username = process.env.NAMECOM_USERNAME?.trim();
  const token = process.env.NAMECOM_TOKEN?.trim();
  if (!username || !token) {
    throw new Error(
      "NAMECOM_USERNAME and NAMECOM_TOKEN are not configured on the server.",
    );
  }
  const apiBase = (process.env.NAMECOM_API_BASE?.trim() || "https://api.name.com").replace(
    /\/+$/,
    "",
  );
  return { username, token, apiBase };
}

export function isNamecomConfigured(): boolean {
  return Boolean(process.env.NAMECOM_USERNAME?.trim() && process.env.NAMECOM_TOKEN?.trim());
}

function buildAuthHeader(username: string, token: string): string {
  return `Basic ${Buffer.from(`${username}:${token}`, "utf8").toString("base64")}`;
}

export function normalizeNamecomHost(raw: NamecomRawRecord, domain: string): string {
  if (raw.host && raw.host.trim() !== "") {
    return raw.host.trim().toLowerCase();
  }
  const fqdn = (raw.fqdn ?? "").trim().toLowerCase().replace(/\.$/, "");
  const root = domain.toLowerCase();
  if (!fqdn || fqdn === root) return "@";
  const suffix = `.${root}`;
  return fqdn.endsWith(suffix) ? fqdn.slice(0, -suffix.length) : fqdn;
}

async function parseNamecomError(res: Response): Promise<string> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string; details?: string };
    if (body.message) {
      detail = body.details ? `${body.message}: ${body.details}` : body.message;
    }
  } catch {
    // Ignore non-JSON error body
  }
  if (res.status === 401 || res.status === 403) {
    return `Name.com API rejected credentials (${detail}). If 2FA is enabled, ensure "Name.com API Access" is toggled On in Account Security.`;
  }
  return `Name.com API error (${detail})`;
}

export async function listNamecomRecords(
  domain: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedProviderRecord[]> {
  const { username, token, apiBase } = getNamecomCredentials();
  const res = await fetchImpl(
    `${apiBase}/core/v1/domains/${encodeURIComponent(domain)}/records?perPage=500`,
    {
      method: "GET",
      headers: {
        Authorization: buildAuthHeader(username, token),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    throw new Error(await parseNamecomError(res));
  }

  const data = (await res.json()) as { records?: NamecomRawRecord[] };
  return (data.records ?? []).map((rec) => {
    const host = normalizeNamecomHost(rec, domain);
    const fqdn = host === "@" ? domain : `${host}.${domain}`;
    return {
      id: String(rec.id),
      host,
      fqdn,
      type: rec.type.toUpperCase(),
      value: rec.answer,
      ttl: rec.ttl ?? 300,
    };
  });
}

export async function createNamecomRecord(
  domain: string,
  input: CreateProviderRecordInput,
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedProviderRecord> {
  const { username, token, apiBase } = getNamecomCredentials();
  const res = await fetchImpl(
    `${apiBase}/core/v1/domains/${encodeURIComponent(domain)}/records`,
    {
      method: "POST",
      headers: {
        Authorization: buildAuthHeader(username, token),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        host: input.host === "@" ? "" : input.host,
        type: input.type,
        answer: input.value,
        ttl: input.ttl ?? 300,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    throw new Error(await parseNamecomError(res));
  }

  const created = (await res.json()) as NamecomRawRecord;
  const host = normalizeNamecomHost(created, domain);
  return {
    id: String(created.id),
    host,
    fqdn: host === "@" ? domain : `${host}.${domain}`,
    type: created.type.toUpperCase(),
    value: created.answer,
    ttl: created.ttl ?? input.ttl ?? 300,
  };
}

export async function deleteNamecomRecord(
  domain: string,
  recordId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { username, token, apiBase } = getNamecomCredentials();
  const res = await fetchImpl(
    `${apiBase}/core/v1/domains/${encodeURIComponent(domain)}/records/${encodeURIComponent(recordId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: buildAuthHeader(username, token),
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    throw new Error(await parseNamecomError(res));
  }
}
