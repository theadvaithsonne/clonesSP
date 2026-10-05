/**
 * Client-side twin of the backend's `services/identifier.ts`.
 *
 * The login screen is a single input that accepts either an email address or a
 * phone number. This decides which the user is typing so the field can react —
 * revealing the country picker once the input reads as a number — and so an
 * obviously-bad value is caught before a request is made.
 *
 * The backend classifies again and is the authority; this exists for the UI,
 * not for trust. Keep the two in step: the email pattern below is the same one
 * used in `lib/rbac-api.ts`, and the "a bare number needs a country code" rule
 * matches the server, which deliberately refuses to guess one.
 */

import { parsePhoneNumberFromString } from "libphonenumber-js";

/** Same pattern as `lib/rbac-api.ts:EMAIL_RE`. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type IdentifierMode = "email" | "phone" | "unknown";

/**
 * What is the user typing, as they type it?
 *
 * Intentionally lenient — this drives which affordance is shown, so it must
 * commit to "phone" from the first digit rather than waiting for a complete
 * number. Anything containing "@" is an email attempt; anything that is only
 * digits and phone punctuation is a phone attempt; an empty or mixed value is
 * unknown and the field stays neutral.
 */
export function detectMode(raw: string): IdentifierMode {
  const v = (raw || "").trim();
  if (!v) return "unknown";
  // "@" is decisive — nobody's phone number contains one.
  if (v.includes("@")) return "email";
  // Any letter means an address is being typed. Checked before the digit
  // rule so "9to5@..." and "abc123" both read as email.
  if (/[a-zA-Z]/.test(v)) return "email";
  // Leading digit or "+" means a number. Deliberately NOT an exact charset
  // match: an earlier version demanded every character be phone-ish, so one
  // stray keystroke ("63955=") threw the field back to email mode and swapped
  // the control out mid-type. A junk character makes the number invalid at
  // submit — it should not change what the user is evidently doing.
  if (/^[+0-9]/.test(v)) return "phone";
  return "unknown";
}

export function isValidEmail(raw: string): boolean {
  return EMAIL_RE.test((raw || "").trim());
}

/** Digits only, capped at the E.164 maximum of 15. */
export function sanitizeLocalNumber(raw: string): string {
  return (raw || "").replace(/\D/g, "").slice(0, 15);
}

/** Assembles E.164 from a dial code and the local part. */
export function toE164(dialCode: string, localNumber: string): string {
  const dial = String(dialCode || "").replace(/^\+/, "").replace(/\D/g, "");
  return `+${dial}${sanitizeLocalNumber(localNumber)}`;
}

/**
 * Splits a stored E.164 number into a dial code and the local part, given the
 * dial codes available in the picker.
 *
 * Longest code first, or "+1" swallows "+91" and an Indian number comes back
 * as American. This bug has been written three separate times in this codebase
 * (ProfilePopover, PhoneVerifyBanner, PlanPhoneVerifySheet); it lives here now.
 */
export function splitE164(
  e164: string,
  dialCodes: string[]
): { dial: string; local: string } | null {
  const v = String(e164 || "").trim();
  if (!v.startsWith("+")) return null;
  const digits = v.slice(1).replace(/\D/g, "");
  const sorted = [...dialCodes]
    .map((d) => d.replace(/^\+/, ""))
    .sort((a, b) => b.length - a.length);
  for (const d of sorted) {
    if (digits.startsWith(d)) return { dial: d, local: digits.slice(d.length) };
  }
  return null;
}

/**
 * The value to send as the `email` field of /auth/request-otp and
 * /auth/verify-otp. The key keeps that name for wire-compatibility — six
 * independent clients post it — while carrying either kind of identifier.
 */
export function buildIdentifier(
  mode: IdentifierMode,
  raw: string,
  dialCode: string
): string {
  if (mode !== "phone") return (raw || "").trim().toLowerCase();
  return toPhoneIdentifier(raw, dialCode);
}

/**
 * Turns what someone typed into E.164, resolving the two things people
 * actually do that string concatenation gets wrong.
 *
 *   "09876543210"   the habitual trunk 0. Naively prefixed this becomes
 *                   "+9109876543210", which is not a real number.
 *   "919876543210"  pasted WITH the country code but no "+". Naively
 *                   prefixed this becomes "+91919876543210" — the doubled
 *                   country code that had to be repaired out of 27 accounts.
 *
 * Rather than guess with length rules — an Indian mobile legitimately starts
 * with 9, so "91…" is genuinely ambiguous — every plausible reading is built
 * and libphonenumber decides. Exactly one valid reading wins; if several are
 * valid the user's literal input is preferred, since inventing a different
 * number is worse than failing.
 */
export function toPhoneIdentifier(raw: string, dialCode: string): string {
  const typed = (raw || "").trim();
  const dial = String(dialCode || "").replace(/^\+/, "").replace(/\D/g, "");
  const digits = sanitizeLocalNumber(typed);
  if (!digits) return `+${dial}`;

  const statedCode = typed.startsWith("+");

  /**
   * Every reading worth trying, most-literal first.
   *
   * An explicit "+" means the user stated their own country, so the picker's
   * code is never applied on top — that is what produced "+91+12048812505"
   * and "+34 34642227423" in the stored data. But a stated code can still be
   * doubled ("+971 971551077547", found on two real accounts), so a
   * de-duplicated reading is offered as a fallback.
   */
  const candidates = statedCode
    ? [`+${digits}`, dedupeLeadingCode(digits)]
    : [`+${dial}${digits}`, `+${digits}`];

  for (const c of candidates) {
    const parsed = parsePhoneNumberFromString(c);
    // `.number` is libphonenumber's canonical E.164, NOT the string handed to
    // it — it strips national trunk prefixes on the way, which is what turns
    // "+91" + "09876543210" into "+919876543210" instead of burying the 0
    // mid-number. Validity alone cannot choose between candidates, because
    // both readings can be "valid" while only one canonicalises correctly.
    if (parsed?.isValid()) return parsed.number;
  }
  // Nothing valid yet — the user is probably mid-type. Return the literal
  // reading so the field round-trips rather than jumping under them.
  return candidates[0];
}

/** "971971551077547" -> "+971551077547" when a code is repeated back-to-back. */
function dedupeLeadingCode(digits: string): string {
  for (let len = 1; len <= 3; len++) {
    const code = digits.slice(0, len);
    if (digits.slice(len).startsWith(code)) {
      return `+${code}${digits.slice(len * 2)}`;
    }
  }
  return `+${digits}`;
}

/** Is what they've typed a number we could actually send a code to? */
export function isValidPhoneInput(raw: string, dialCode: string): boolean {
  return parsePhoneNumberFromString(toPhoneIdentifier(raw, dialCode))?.isValid() === true;
}

/**
 * The country implied by a pasted "+CC…" value, so the picker can follow what
 * was typed instead of contradicting it.
 */
export function countryOfTyped(raw: string): string | null {
  const v = (raw || "").trim();
  if (!v.startsWith("+")) return null;
  return parsePhoneNumberFromString(v)?.country || null;
}

/** Display form for the "we sent a code to X" line. */
export function formatIdentifier(value: string): string {
  const v = (value || "").trim();
  if (!v.startsWith("+")) return v;
  const digits = v.slice(1).replace(/\D/g, "");
  // The country code's length can't be read off the string — "+1..." and
  // "+91..." and "+971..." are all possible — so don't try. Treat the last 10
  // digits as the subscriber number and whatever precedes them as the code.
  // "+919876543210" -> "+91 98765 43210"
  if (digits.length <= 10) return `+${digits}`;
  const cc = digits.slice(0, digits.length - 10);
  const local = digits.slice(-10);
  return `+${cc} ${local.slice(0, 5)} ${local.slice(5)}`;
}
