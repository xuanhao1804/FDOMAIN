export type RecordType = "A" | "AAAA" | "CNAME" | "TXT";

export interface UnmanagedRule {
  label: string;
  types: string;
  target?: string;
}

export interface RegistryConfig {
  rootDomain: string;
  repository: string;
  lookupSubdomain: string;
  admins: string[];
  trusted: string[];
  reservedLabels: string[];
  unmanaged: UnmanagedRule[];
  limits: {
    maxTotalRecords: number;
    warnAtRecords: number;
    maxDeletionsPerPush: number;
  };
}

export type SubdomainRecords =
  | {
      CNAME: string;
    }
  | {
      A?: string[];
      AAAA?: string[];
      TXT?: string[];
    };

export type ExtraRecordValue =
  | {
      CNAME: string;
    }
  | {
      TXT: string[];
    };

export interface SubdomainFile {
  owner: {
    github: string;
    contact?: string;
  };
  description: string;
  records: SubdomainRecords;
  vercelVerify?: string[];
  extra?: Record<string, ExtraRecordValue>;
}

export interface SubdomainEntry {
  label: string;
  filename: string;
  data: SubdomainFile;
}

export interface CompiledDnsRecord {
  label: string;
  type: RecordType;
  value: string;
  sourceLabel: string;
}

export interface DnsManifest {
  rootDomain: string;
  unmanaged: UnmanagedRule[];
  records: CompiledDnsRecord[];
}
