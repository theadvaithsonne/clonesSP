// src/services/comboWindow.ts
//
// The 24-hour window in which the free-first-month offer is available.
//
// A user has 24 hours from FIRST completing their profile to buy the $25
// Unilevel Plus licence and get their first NetworkChain month free. After
// that the offer is gone: they pay $25 + $36 (or $25 + a term price) with no
// free month, and coverage starts immediately.
//
// This is a pricing-eligibility rule, NOT a trial. Nothing is locked, revoked
// or gated by the window — a user who lets it lapse simply has no NetworkChain
// subscription until they buy one at full price.
//
// Deliberately a leaf module: it imports nothing but types. The billing side of
// this codebase already has a circular-import problem (thirdPartyTerms →
// thirdPartyInvoice → invoice → razorpay), and this predicate is called from
// inside that cluster.

/**
 * Window length in hours. A code constant, deliberately NOT an env var — the
 * rule goes live with the deploy, and an unset/typo'd env var must never be
 * able to widen (or silently kill) the offer in production. Changing it is a
 * code change with a review, like the prices themselves.
 */
export const COMBO_WINDOW_HOURS = 24;

export interface ComboWindow {
  /** Whether the free-first-month offer can still be taken. */
  open: boolean;
  /** When the profile was first completed. Null if it never was. */
  startsAt: Date | null;
  /** When the offer lapses. Null if the clock never started. */
  expiresAt: Date | null;
  /** Convenience for clients rendering a countdown. 0 once closed. */
  secondsRemaining: number;
  windowHours: number;
}

const CLOSED: ComboWindow = {
  open: false,
  startsAt: null,
  expiresAt: null,
  secondsRemaining: 0,
  windowHours: COMBO_WINDOW_HOURS,
};

/**
 * Resolve the offer window for a user.
 *
 * Natural rule: 24h from `profileCompletedAt`. A missing `profileCompletedAt`
 * means CLOSED — fails safe (a missing field can never accidentally hand out
 * a free month), and matches the pre-existing behaviour for users who
 * completed their profile before the field existed.
 *
 * Admin override: `offerExpiresAtOverride` (set by
 * `POST /garage-admin/users/:userId/extend-offer`) — when present AND later
 * than the natural expiry, becomes the effective expiry. Never shortens the
 * window (we pick `max(natural, override)`), so an admin extension can't
 * accidentally cut a still-open natural window short.
 *
 * @param now Pass the request's single `new Date()` so every check within one
 *            request agrees, rather than drifting across comparisons.
 */
export function comboWindowFor(
  user:
    | {
        profileCompletedAt?: Date | string | null;
        offerExpiresAtOverride?: Date | string | null;
      }
    | null
    | undefined,
  now: Date = new Date()
): ComboWindow {
  const hours = COMBO_WINDOW_HOURS;

  // Natural expiry from profileCompletedAt.
  const rawStart = user?.profileCompletedAt;
  let naturalStartsAt: Date | null = null;
  let naturalExpiresAt: Date | null = null;
  if (rawStart) {
    const s = rawStart instanceof Date ? rawStart : new Date(rawStart);
    if (!Number.isNaN(s.getTime())) {
      naturalStartsAt = s;
      naturalExpiresAt = new Date(s.getTime() + hours * 60 * 60 * 1000);
    }
  }

  // Admin override expiry (nullable).
  const rawOverride = user?.offerExpiresAtOverride;
  let overrideExpiresAt: Date | null = null;
  if (rawOverride) {
    const o = rawOverride instanceof Date ? rawOverride : new Date(rawOverride);
    if (!Number.isNaN(o.getTime())) overrideExpiresAt = o;
  }

  // Whichever expiry is later wins. Either alone if the other is null; both
  // null → the whole window stays closed (existing fail-safe behaviour).
  let effectiveExpiresAt: Date | null;
  if (naturalExpiresAt && overrideExpiresAt) {
    effectiveExpiresAt =
      overrideExpiresAt.getTime() > naturalExpiresAt.getTime()
        ? overrideExpiresAt
        : naturalExpiresAt;
  } else {
    effectiveExpiresAt = naturalExpiresAt || overrideExpiresAt || null;
  }

  if (!effectiveExpiresAt) return CLOSED;

  // `startsAt` prefers the true profile-completion moment so the FE always
  // knows when the user first became eligible. When admin extends a user
  // who never completed their profile (natural = null), synthesize
  // `startsAt = effectiveExpiresAt - windowHours` so the countdown math
  // stays sane.
  const startsAt =
    naturalStartsAt ??
    new Date(effectiveExpiresAt.getTime() - hours * 60 * 60 * 1000);

  const msRemaining = effectiveExpiresAt.getTime() - now.getTime();

  return {
    open: msRemaining > 0,
    startsAt,
    expiresAt: effectiveExpiresAt,
    secondsRemaining: msRemaining > 0 ? Math.ceil(msRemaining / 1000) : 0,
    windowHours: hours,
  };
}

export type ComboWindowStatus = "not_started" | "open" | "expired" | "completed";

/**
 * The four-state status of a user's offer window, computed from an already-
 * resolved ComboWindow plus (optionally) when the user activated Unilevel Plus.
 * Mirrors the logic in garageAdmin.controller.ts listAllUsers so the admin
 * list, the downline table, and the windowStatus filter can never drift.
 *
 * completed = a UP purchase whose purchasedAt is at/before the effective
 * expiry (activated inside the window). Precedence: not_started → completed →
 * open → expired.
 */
export function comboWindowStatus(
  window: ComboWindow,
  opts: { upPurchasedAt?: Date | string | null } = {}
): ComboWindowStatus {
  if (!window.startsAt) return "not_started";
  const raw = opts.upPurchasedAt;
  if (raw && window.expiresAt) {
    const p = raw instanceof Date ? raw : new Date(raw);
    if (!Number.isNaN(p.getTime()) && p.getTime() <= window.expiresAt.getTime()) {
      return "completed";
    }
  }
  return window.open ? "open" : "expired";
}
