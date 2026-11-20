import type { DnsProviderType } from "../registry";

export interface LiveDnsRecord {
  id: string | null;
  domain: string;
  host: string;
  fqdn: string;
  type: string;
  value: string;
  ttl: number;
  provider: DnsProviderType;
  protected: boolean;
  protectedReason: string | null;
  reserved: boolean;
  canDelete: boolean;
}

export interface CreateProviderRecordInput {
  host: string;
  type: "CNAME" | "A" | "AAAA" | "TXT";
  value: string;
  ttl?: number;
}

export interface CreatedProviderRecord {
  id: string;
  host: string;
  fqdn: string;
  type: string;
  value: string;
  ttl: number;
}

export interface ProviderEnvStatus {
  adminAuthConfigured: boolean;
  namecomConfigured: boolean;
  cloudflareConfigured: boolean;
}

export interface DomainCapability {
  domain: string;
  registrar: string;
  dnsProvider: DnsProviderType;
  mode: "auto-ready" | "auto-needs-env" | "manual-copy";
  note?: string;
}
