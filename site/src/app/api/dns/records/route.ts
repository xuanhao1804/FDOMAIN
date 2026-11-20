import { metric } from "@vercel/functions";
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSameOrigin } from "@/lib/auth";
import { isServerAdminAuthenticated } from "@/lib/auth-cookies";
import {
  createProviderRecords,
  fetchDomainRecords,
  removeProviderRecord,
} from "@/lib/dns-providers";
import type { CreateProviderRecordInput } from "@/lib/dns-providers/types";
import {
  isReservedSubdomainLabel,
  isValidCnameTarget,
  isValidIpv4,
  isValidIpv6,
  isValidSubdomainLabel,
  normalizeExtraPrefix,
  normalizeTargetValue,
} from "@/lib/dns-rules";
import { loadSiteRegistryData } from "@/lib/registry";

export const dynamic = "force-dynamic";

const CreateRecordsBodySchema = z.object({
  rootDomain: z.string().trim().toLowerCase().min(1),
  label: z.string().trim().toLowerCase().min(1),
  recordType: z.enum(["CNAME", "A", "AAAA", "TXT"]),
  target: z.string().trim().min(1).max(2048),
  ttl: z.number().int().min(60).max(86400).optional(),
  vercelVerify: z.string().trim().max(512).optional(),
  extraName: z.string().trim().max(64).optional(),
  extraTxt: z.string().trim().max(2048).optional(),
  allowReserved: z.boolean().optional(),
});

const DeleteRecordBodySchema = z.object({
  rootDomain: z.string().trim().toLowerCase().min(1),
  recordId: z.string().trim().min(1).max(200),
  allowReserved: z.boolean().optional(),
});

export async function GET(request: Request) {
  const startedAt = performance.now();
  const data = loadSiteRegistryData();
  const isAdmin = await isServerAdminAuthenticated();
  const url = new URL(request.url);
  const requestedDomain = url.searchParams.get("domain")?.trim().toLowerCase();

  const targets = requestedDomain
    ? data.rootDomains.filter((d) => d.domain.toLowerCase() === requestedDomain)
    : data.rootDomains;

  if (requestedDomain && targets.length === 0) {
    return NextResponse.json(
      { error: `Unknown root domain "${requestedDomain}".` },
      { status: 400 },
    );
  }

  try {
    const zones = await Promise.all(
      targets.map(async (domainCfg) => {
        const res = await fetchDomainRecords(
          domainCfg,
          data.unmanaged,
          data.reservedLabels,
          isAdmin,
        );
        return {
          domain: domainCfg.domain,
          provider: domainCfg.dnsProvider,
          source: res.source,
          records: res.records,
        };
      }),
    );

    const providerTag = targets.length === 1 ? targets[0]!.dnsProvider : "all";
    metric("fdomain.dns_list", 1, {
      provider: providerTag,
      outcome: "success",
      access: isAdmin ? "admin" : "public",
    });

    return NextResponse.json({
      authenticated: isAdmin,
      zones,
      records: zones.flatMap((z) => z.records),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch live DNS records.";
    metric("fdomain.dns_list", 1, {
      provider: targets[0]?.dnsProvider ?? "unknown",
      outcome: "error",
      access: isAdmin ? "admin" : "public",
    });
    return NextResponse.json({ error: msg }, { status: 502 });
  } finally {
    metric("fdomain.dns_list.duration_ms", performance.now() - startedAt);
  }
}

export async function POST(request: Request) {
  const startedAt = performance.now();
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }
  if (!(await isServerAdminAuthenticated())) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = CreateRecordsBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid DNS record request." },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const data = loadSiteRegistryData();
  const domainCfg = data.rootDomains.find(
    (d) => d.domain.toLowerCase() === input.rootDomain.toLowerCase(),
  );
  if (!domainCfg) {
    return NextResponse.json(
      { error: `Unknown root domain "${input.rootDomain}".` },
      { status: 400 },
    );
  }

  if (!isValidSubdomainLabel(input.label)) {
    return NextResponse.json(
      {
        error:
          "Subdomain label must use lowercase letters, digits, hyphens, or dots (for nested labels).",
      },
      { status: 400 },
    );
  }

  if (`${input.label}.${domainCfg.domain}`.length > 253) {
    return NextResponse.json({ error: "Full domain exceeds 253 characters." }, { status: 400 });
  }

  if (
    (input.recordType === "CNAME" && !isValidCnameTarget(input.target)) ||
    (input.recordType === "A" && !isValidIpv4(input.target)) ||
    (input.recordType === "AAAA" && !isValidIpv6(input.target))
  ) {
    return NextResponse.json(
      { error: `Invalid ${input.recordType} target value "${input.target}".` },
      { status: 400 },
    );
  }

  if (
    isReservedSubdomainLabel(input.label, data.reservedLabels) &&
    !input.allowReserved
  ) {
    return NextResponse.json(
      {
        error: `Label "${input.label}" is reserved. Check the confirmation box before applying.`,
        requiresReservedConfirmation: true,
      },
      { status: 409 },
    );
  }

  const toCreate: CreateProviderRecordInput[] = [
    {
      host: input.label,
      type: input.recordType,
      value: normalizeTargetValue(input.recordType, input.target),
      ttl: input.ttl ?? 300,
    },
  ];

  if (input.vercelVerify && input.vercelVerify.length > 0) {
    const expectedPrefix = `vc-domain-verify=${input.label}.${domainCfg.domain},`;
    if (
      !input.vercelVerify.startsWith(expectedPrefix) ||
      input.vercelVerify.length <= expectedPrefix.length
    ) {
      return NextResponse.json(
        { error: `vercelVerify must start with "${expectedPrefix}" followed by a token.` },
        { status: 400 },
      );
    }
    toCreate.push({
      host: "_vercel",
      type: "TXT",
      value: input.vercelVerify,
      ttl: input.ttl ?? 300,
    });
  }

  if (input.extraName && input.extraTxt) {
    const prefix = normalizeExtraPrefix(input.extraName);
    if (!prefix) {
      return NextResponse.json(
        { error: "Extra challenge prefix must match _[a-z0-9-]+ (<= 63 chars)." },
        { status: 400 },
      );
    }
    toCreate.push({
      host: `${prefix}.${input.label}`,
      type: "TXT",
      value: input.extraTxt,
      ttl: input.ttl ?? 300,
    });
  }

  try {
    const created = await createProviderRecords(
      domainCfg,
      toCreate,
      data.unmanaged,
      data.reservedLabels,
      Boolean(input.allowReserved),
    );
    metric("fdomain.dns_create", 1, {
      provider: domainCfg.dnsProvider,
      outcome: "success",
    });
    return NextResponse.json({ ok: true, created }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create DNS records.";
    metric("fdomain.dns_create", 1, {
      provider: domainCfg.dnsProvider,
      outcome: "error",
    });
    const status = msg.startsWith("Blocked protected") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  } finally {
    metric("fdomain.dns_create.duration_ms", performance.now() - startedAt);
  }
}

export async function DELETE(request: Request) {
  const startedAt = performance.now();
  if (!assertSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }
  if (!(await isServerAdminAuthenticated())) {
    return NextResponse.json({ error: "Admin login required." }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const parsed = DeleteRecordBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid delete payload." },
      { status: 400 },
    );
  }

  const { rootDomain, recordId, allowReserved = false } = parsed.data;
  const data = loadSiteRegistryData();
  const domainCfg = data.rootDomains.find(
    (d) => d.domain.toLowerCase() === rootDomain.toLowerCase(),
  );
  if (!domainCfg) {
    return NextResponse.json({ error: `Unknown root domain "${rootDomain}".` }, { status: 400 });
  }

  try {
    const removed = await removeProviderRecord(
      domainCfg,
      recordId,
      data.unmanaged,
      data.reservedLabels,
      allowReserved,
    );
    metric("fdomain.dns_delete", 1, {
      provider: domainCfg.dnsProvider,
      outcome: "success",
    });
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete DNS record.";
    metric("fdomain.dns_delete", 1, {
      provider: domainCfg.dnsProvider,
      outcome: "error",
    });
    const status = msg.startsWith("Cannot delete protected") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  } finally {
    metric("fdomain.dns_delete.duration_ms", performance.now() - startedAt);
  }
}
