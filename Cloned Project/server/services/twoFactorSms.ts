// src/services/twoFactorSms.ts
//
// Thin wrapper over 2Factor.in's transactional SMS OTP API. We generate the
// OTP ourselves (services/otp.ts stores + verifies it against Mongo with a
// 10-minute TTL); 2Factor is used purely as the SMS delivery pipe. This is
// the "send a specific OTP" endpoint — NOT AUTOGEN — so verification stays
// local and we never depend on 2Factor holding session state.
//
// Endpoint shape (from the working curl):
//   https://2factor.in/API/V1/{API_KEY}/SMS/{phone}/{otp}/{template}
//   → { "Status": "Success", "Details": "<tracking-session-id>" }
//
// Config (config/env.ts):
//   TWO_FACTOR_API_KEY       — required; SMS send is a no-op without it
//   TWO_FACTOR_OTP_TEMPLATE  — DLT-approved template name (default "OTP1")
import { env } from "../config/env";

export function twoFactorConfigured(): boolean {
  return !!env.TWO_FACTOR_API_KEY;
}

/**
 * Normalise a phone number into the E.164 shape 2Factor expects
 * (`+<countrycode><number>`). Bare 10-digit Indian numbers get a +91
 * prefix; anything already carrying a country code is passed through.
 * Returns null when the input can't be coerced into a plausible number.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return null;
  // Keep a leading +, strip every other non-digit (spaces, dashes, brackets).
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;
  if (hasPlus) {
    // Already international — 8–15 digits after the +.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  // Bare 10-digit number → assume India.
  if (digits.length === 10) return `+91${digits}`;
  // 12 digits starting 91 → already has the country code, just missing the +.
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  // Anything else in a sane international range — trust it.
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`;
  return null;
}

/**
 * The shape a phone number must be STORED in.
 *
 * Login resolves an account by an exact match on E.164 — see
 * `identifierQuery` in services/identifier.ts — so a number stored in any
 * other shape is invisible to it. A country picker that submits
 * "+1 5149659854" is enough: the next time that person signs in by phone,
 * the lookup finds nothing and mints a SECOND account, with its own
 * affiliateId and its own position in the referral tree. That has happened
 * 19 times so far, and it splits one person's commissions across two
 * identities.
 *
 * Every path that writes User.phone must go through here.
 *
 * Input we can't parse is stored as typed rather than dropped: it is too
 * short or malformed to collide with a real number, and throwing away what
 * an affiliate entered loses information a human may still need.
 */
export function storablePhone(raw?: string | null): string | undefined {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return undefined;
  return normalizePhone(trimmed) ?? trimmed;
}

/**
 * Send a pre-generated OTP to a phone via 2Factor SMS. Throws on a
 * misconfiguration or a non-Success response so the caller can surface a
 * clean error to the client (and NOT mark the OTP as sent).
 */
export async function sendOtpSms(phone: string, code: string): Promise<string> {
  if (!env.TWO_FACTOR_API_KEY) {
    throw new Error("SMS OTP is not configured (TWO_FACTOR_API_KEY missing)");
  }
  const to = normalizePhone(phone);
  if (!to) {
    throw new Error("Invalid phone number");
  }
  const template = env.TWO_FACTOR_OTP_TEMPLATE || "OTP1";
  const url =
    `https://2factor.in/API/V1/${encodeURIComponent(env.TWO_FACTOR_API_KEY)}` +
    `/SMS/${encodeURIComponent(to)}/${encodeURIComponent(code)}/${encodeURIComponent(template)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, { method: "GET", signal: controller.signal });
    const text = await res.text();
    let body: { Status?: string; Details?: string } | null = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    if (!res.ok || body?.Status !== "Success") {
      const reason = body?.Details || text || `HTTP ${res.status}`;
      throw new Error(`2Factor SMS failed: ${String(reason).slice(0, 200)}`);
    }
    // Details is 2Factor's tracking/session id — we only log it; verification
    // is done locally against our own stored OTP.
    return body?.Details || "";
  } finally {
    clearTimeout(timer);
  }
}
