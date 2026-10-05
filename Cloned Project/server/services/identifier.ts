import { parsePhoneNumberFromString } from "libphonenumber-js";
import type { FilterQuery } from "mongoose";

/**
 * Decides whether a typed string is an email address or a phone number, and
 * puts it in canonical form. This is the ONLY place that decision is made.
 *
 * Login accepts either in a single field, so the request key is still called
 * `email` for wire-compatibility while carrying either kind of value. Every
 * consumer classifies through here rather than sniffing for "@" locally,
 * which is how the two forms stay consistent across ~61 identity lookups.
 *
 * ── Why this never infers a country ──────────────────────────────────────
 * `services/twoFactorSms.ts:normalizePhone` prefixes +91 to any bare 10-digit
 * input. That is a reasonable last resort when DELIVERING to a number already
 * on file — and it is how 349 accounts ended up holding an assumed-Indian
 * number nobody stated. On a login field the same guess resolves to a
 * different real person's account, or sends their OTP to a stranger's
 * handset. So a bare number is rejected with `country_code_required` and the
 * caller (the country picker in the login field) supplies the code.
 *
 * Use `normalizePhone` for delivery to a stored number; use this for deciding
 * WHO someone is.
 */

export type IdentifierKind = "email" | "phone" | "invalid";

export type Identifier =
  | { kind: "email"; email: string }
  /** Always E.164, e.g. "+919876543210". */
  | { kind: "phone"; phone: string }
  | {
      kind: "invalid";
      reason: "empty" | "country_code_required" | "malformed";
    };

/**
 * Mirrors `lib/rbac-api.ts:EMAIL_RE` on the frontend so both sides agree on
 * what counts as an email before a request is made.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function classifyIdentifier(raw: unknown): Identifier {
  const value = String(raw ?? "").trim();
  if (!value) return { kind: "invalid", reason: "empty" };

  // "@" is the discriminator. A phone number never contains one, and an
  // address that contains one but fails the pattern is a malformed email
  // rather than something to retry as a phone.
  if (value.includes("@")) {
    return EMAIL_RE.test(value)
      ? { kind: "email", email: value.toLowerCase() }
      : { kind: "invalid", reason: "malformed" };
  }

  // Digits, spaces and the usual separators — treat as an attempted phone.
  if (!/^[+0-9()\-.\s]+$/.test(value)) {
    return { kind: "invalid", reason: "malformed" };
  }

  if (!value.startsWith("+")) {
    // Deliberately NOT guessed. See the note above.
    return { kind: "invalid", reason: "country_code_required" };
  }

  const parsed = parsePhoneNumberFromString(value);
  if (!parsed || !parsed.isValid()) {
    return { kind: "invalid", reason: "malformed" };
  }
  return { kind: "phone", phone: parsed.number };
}

/** The Mongo filter that finds the user this identifier refers to. */
export function identifierQuery(id: Identifier): FilterQuery<any> {
  if (id.kind === "email") return { email: id.email };
  if (id.kind === "phone") return { phone: id.phone };
  // Matches nothing rather than everything — an invalid identifier must never
  // widen a query into "any user".
  return { _id: null };
}

/**
 * The canonical string for an identifier — what gets stored as the OtpCode
 * key and echoed back to the client.
 */
export function identifierValue(id: Identifier): string {
  if (id.kind === "email") return id.email;
  if (id.kind === "phone") return id.phone;
  return "";
}

/** Human-readable reason, safe to return to a client. */
export function identifierError(id: Identifier): string {
  if (id.kind !== "invalid") return "";
  if (id.reason === "empty") return "Enter your email or phone number";
  if (id.reason === "country_code_required")
    return "Include the country code, e.g. +919876543210";
  return "Enter a valid email or phone number";
}

/**
 * Resolves the account an identifier refers to, or null.
 *
 * Imported lazily so this module stays usable from scripts and tests without
 * pulling the whole Mongoose model graph.
 */
export async function findUserByIdentifier(
  id: Identifier,
  select?: string
): Promise<any | null> {
  if (id.kind === "invalid") return null;
  const { User } = await import("../models/user.model");
  const q = User.findOne(identifierQuery(id));
  return select ? q.select(select) : q;
}
