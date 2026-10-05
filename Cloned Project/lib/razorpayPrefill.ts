// Helpers for prefilling the Razorpay Standard Checkout `prefill` block —
// specifically the `contact` (phone) field which the JWT doesn't carry.
//
// Razorpay's checkout SDK accepts `prefill: { name, email, contact }` on
// every popup invocation. Without it, the user gets an extra "Contact
// details" step on every payment. Razorpay accepts contact either as
// `"+{country}{number}"` or as bare digits (defaults to +91). See:
// https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/
//
// NOTE: Razorpay's HOSTED subscription page (the `short_url` returned by
// the Subscriptions API) does NOT support prefill — Razorpay documents
// this as a government-guidelines limitation. This helper only affects
// in-page SDK invocations.

import { API_URL } from "@/lib/api";
import { getToken, getUserDataFromToken } from "@/lib/auth";

// In-memory + sessionStorage cache so a logged-in user only triggers one
// /profile fetch per browser session. Keyed by userId so a within-tab
// account switch (uncommon — most flows full-reload on token swap — but
// possible in dev) doesn't leak the previous user's phone.
let cachedForUserId: string | null = null;
let inMemoryPhone: string | null | undefined = undefined; // undefined = not loaded
let inflightFetch: Promise<string> | null = null;
let inflightForUserId: string | null = null;

function sessionKey(userId: string): string {
  return `rzp_prefill_phone:${userId}`;
}

/**
 * Normalize a phone number into Razorpay's expected `+{country}{digits}`
 * format. Razorpay accepts bare digits and defaults to +91, but being
 * explicit avoids surprises for non-India numbers.
 *
 *  "+91 98765 43210" → "+919876543210"
 *  "9876543210"       → "+919876543210"   (defaulted to +91)
 *  ""                 → undefined         (Razorpay treats undefined as "no prefill")
 */
export function formatRazorpayContact(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = String(raw).trim();
  if (!trimmed) return undefined;

  // Keep a leading + if present; strip everything else non-digit.
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return undefined;

  if (hasPlus) return `+${digits}`;
  // Bare digits — default to +91 (matches Razorpay's own default; explicit
  // here for clarity in logs / panic-debug).
  return `+91${digits}`;
}

/**
 * Get the authenticated user's phone for Razorpay prefill. Lazy-loads via
 * /profile, caches per session, returns undefined when:
 *   - no JWT in localStorage (guest)
 *   - profile fetch fails
 *   - user has no phone on file
 *
 * Safe to call from any in-page Razorpay invocation. For NON-authenticated
 * flows (e.g. guest invoice pay via OTP), pass the phone directly into
 * `formatRazorpayContact` instead of using this helper.
 */
export async function getRazorpayContactForCurrentUser(): Promise<string | undefined> {
  if (typeof window === "undefined") return undefined;

  const user = getUserDataFromToken();
  if (!user.userId) return undefined;

  // Cache hits MUST match the current user — otherwise we'd leak the
  // previous user's phone after a within-tab account switch.
  if (cachedForUserId === user.userId && inMemoryPhone !== undefined) {
    return formatRazorpayContact(inMemoryPhone);
  }
  if (inflightFetch && inflightForUserId === user.userId) {
    return inflightFetch.then(formatRazorpayContact);
  }

  // sessionStorage cache so we don't hit /profile on every checkout reopen.
  try {
    const cached = sessionStorage.getItem(sessionKey(user.userId));
    if (cached !== null) {
      cachedForUserId = user.userId;
      inMemoryPhone = cached;
      return formatRazorpayContact(cached);
    }
  } catch {
    // sessionStorage can throw in strict private browsing — fall through.
  }

  inflightForUserId = user.userId;
  inflightFetch = (async () => {
    try {
      const token = getToken();
      const res = await fetch(`${API_URL}/profile?userId=${user.userId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return "";
      const data = await res.json();
      const phone = String(data?.phone || "").trim();
      cachedForUserId = user.userId!;
      inMemoryPhone = phone;
      try {
        sessionStorage.setItem(sessionKey(user.userId!), phone);
      } catch {
        // storage quota / private mode — fine, in-memory cache still works.
      }
      return phone;
    } catch {
      cachedForUserId = user.userId!;
      inMemoryPhone = "";
      return "";
    } finally {
      inflightFetch = null;
      inflightForUserId = null;
    }
  })();

  return inflightFetch.then(formatRazorpayContact);
}

/**
 * Imperatively reset the cache — call after the user updates their phone
 * in profile settings so the next Razorpay popup picks up the new number.
 */
export function resetRazorpayContactCache(): void {
  cachedForUserId = null;
  inMemoryPhone = undefined;
  inflightFetch = null;
  inflightForUserId = null;
  if (typeof window === "undefined") return;
  const user = getUserDataFromToken();
  if (!user.userId) return;
  try {
    sessionStorage.removeItem(sessionKey(user.userId));
  } catch {
    /* noop */
  }
}
