// src/services/resendDomains.ts
//
// Registering a white-label org's own domain with Resend, so its transactional
// mail (OTPs, magic links, offer reminders) can be sent FROM that domain
// instead of Garage's.
//
// This is deliberately separate from the Mailcow flow in routes/initialSetup.ts.
// The two solve different problems and both are needed:
//
//   Mailcow  — mailboxes. Receiving, IMAP, founder@theirdomain.com as a real
//              account someone logs into.
//   Resend   — transactional sending only. No inbox, no IMAP, no receiving.
//
// Resend cannot replace Mailcow; it sits alongside it.
//
// ── The SPF trap ──────────────────────────────────────────────────────────
//
// A domain may publish only ONE SPF record. If the org already runs Mailcow on
// this domain it has an SPF record already, and adding Resend's as a second
// TXT breaks BOTH — receivers see two SPF records and treat the result as
// permerror, so mail starts failing authentication with nothing in any log to
// explain it. The two must be MERGED into a single record carrying both
// includes. `mergeSpf` below does that, and the caller shows the merged value
// rather than Resend's raw one.
import { env } from "../config/env";

const API = "https://api.resend.com";

export interface ResendDnsRecord {
  record: string; // "SPF" | "DKIM" | "DMARC"
  name: string;
  type: string; // "TXT" | "MX" | "CNAME"
  value: string;
  ttl?: string;
  priority?: number;
  status?: string;
}

export interface ResendDomain {
  id: string;
  name: string;
  /** "not_started" | "pending" | "verified" | "failure" | "temporary_failure" */
  status: string;
  records: ResendDnsRecord[];
}

export function resendConfigured(): boolean {
  return !!env.RESEND_API_KEY;
}

async function resendRequest<T>(
  path: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: unknown
): Promise<T> {
  if (!env.RESEND_API_KEY) {
    throw new Error("Resend is not configured (RESEND_API_KEY missing)");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    let parsed: any = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }

    if (!res.ok) {
      const reason =
        parsed?.message || parsed?.error?.message || text || `HTTP ${res.status}`;
      throw new Error(`Resend: ${String(reason).slice(0, 300)}`);
    }
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Merge Resend's SPF include into an existing SPF record.
 *
 * Returns the single record the domain should publish. If there is no existing
 * record, Resend's own value is already correct and is returned unchanged.
 *
 * Kept deliberately conservative: mechanisms from the existing record are
 * preserved in order and only the missing include is inserted before the
 * terminal `all`, because SPF is evaluated left to right and moving things
 * around can change which mechanism matches first.
 */
export function mergeSpf(existing: string | null, resendValue: string): string {
  if (!existing || !existing.trim()) return resendValue;

  const includeMatch = resendValue.match(/include:[^\s"]+/i);
  const include = includeMatch?.[0];
  // Nothing recognisable to merge — leave the existing record untouched rather
  // than guessing and breaking a working setup.
  if (!include) return existing;

  if (existing.toLowerCase().includes(include.toLowerCase())) return existing;

  const parts = existing.trim().replace(/^"|"$/g, "").split(/\s+/);
  const allIdx = parts.findIndex((p) => /^[~+\-?]?all$/i.test(p));
  if (allIdx === -1) {
    return [...parts, include].join(" ");
  }
  return [...parts.slice(0, allIdx), include, ...parts.slice(allIdx)].join(" ");
}

/**
 * Register a domain with Resend and get back the DNS records to publish.
 *
 * Idempotent in practice: Resend rejects a duplicate, so the caller looks the
 * domain up first and only adds when it is genuinely new.
 */
export async function addResendDomain(
  domain: string,
  region = "us-east-1"
): Promise<ResendDomain> {
  const body = await resendRequest<any>("/domains", "POST", {
    name: domain.toLowerCase(),
    region,
  });
  return {
    id: body.id,
    name: body.name,
    status: body.status || "not_started",
    records: body.records || [],
  };
}

/** Current status + records. Used to poll after the founder points DNS. */
export async function getResendDomain(id: string): Promise<ResendDomain> {
  const body = await resendRequest<any>(`/domains/${id}`);
  return {
    id: body.id,
    name: body.name,
    status: body.status || "not_started",
    records: body.records || [],
  };
}

/**
 * Ask Resend to re-check DNS now.
 *
 * Verification is asynchronous on their side: a 200 means "check started",
 * not "verified". The caller re-reads the domain afterwards for the real
 * status rather than reporting success from this call.
 */
export async function verifyResendDomain(id: string): Promise<void> {
  await resendRequest(`/domains/${id}/verify`, "POST");
}

/**
 * Remove a domain from the Resend account.
 *
 * Irreversible on their side: re-adding issues fresh DKIM keys, so the DNS
 * records have to be published again. Callers should only do this when no org
 * still points at the domain.
 */
export async function deleteResendDomain(id: string): Promise<void> {
  await resendRequest(`/domains/${id}`, "DELETE");
}

/** All domains on the account — used to find one already registered. */
export async function listResendDomains(): Promise<ResendDomain[]> {
  const body = await resendRequest<any>("/domains");
  return (body?.data || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    status: d.status,
    records: d.records || [],
  }));
}
