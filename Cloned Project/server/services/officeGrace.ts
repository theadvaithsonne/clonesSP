// src/services/officeGrace.ts
//
// The 30-day office grace programme.
//
// Normally an office needs an active $25 Unilevel Plus licence before it can
// be created (services/officeEligibility.ts). Integrating platforms may skip
// that gate for a STARTER office and hand the founder 30 days to buy the
// licence instead — see routes/platformOffices.ts.
//
// Two rules make this safe to bolt onto a live system:
//
//   1. Status is DERIVED, never stored. An office is "licensed" the moment its
//      founder holds a licence (whenever that happens — day 3 or day 300),
//      "grace" while the clock runs, and "locked" after. There is no status
//      field to go stale, no cron to miss a day, and buying the licence needs
//      no write here at all.
//
//   2. One grace per user, keyed on the founder. A second office needs a real
//      licence, so the programme cannot be farmed.
//
// ENFORCEMENT IS ADVISORY. This module reports "locked"; it does not block
// anything. The integrating platform is expected to honour it in its own UI.
// A locked office remains fully usable against the rest of the Garage API —
// deliberately, per the product decision, but worth knowing before anyone
// treats `locked` as a security boundary.

import { Types } from "mongoose";
import { Organization } from "../models/organization.model";
import { getUserPurchase } from "./unilevelPlusCommission";

/** Length of the grace window. A code constant for the same reason
 *  COMBO_WINDOW_HOURS is: a typo'd env var must not be able to hand out a
 *  year of free office, or silently kill the programme. */
export const OFFICE_GRACE_DAYS = 30;

export type GraceStatus = "licensed" | "grace" | "locked" | "none";

export interface GraceState {
  status: GraceStatus;
  /** Null unless the office was created under the programme. */
  startedAt: Date | null;
  expiresAt: Date | null;
  /** 0 once the window has closed, or when there is no window. */
  secondsRemaining: number;
  daysRemaining: number;
  /** Does the founder hold an active licence right now? */
  licenceActive: boolean;
  graceDays: number;
}

const ZERO = {
  startedAt: null,
  expiresAt: null,
  secondsRemaining: 0,
  daysRemaining: 0,
  graceDays: OFFICE_GRACE_DAYS,
};

/**
 * Resolve an office's grace state.
 *
 * `licenceActive` is passed in rather than looked up so a caller reporting on
 * several offices for one founder does the licence query once.
 */
export function graceStatusFor(
  grace:
    | { startedAt?: Date | null; expiresAt?: Date | null }
    | null
    | undefined,
  licenceActive: boolean,
  now: Date = new Date()
): GraceState {
  // A licence trumps everything, including an expired window: whatever the
  // office was, it is a normal office now.
  if (licenceActive) {
    return {
      ...ZERO,
      status: "licensed",
      startedAt: grace?.startedAt ?? null,
      expiresAt: grace?.expiresAt ?? null,
      licenceActive: true,
    };
  }

  const expiresAt = grace?.expiresAt ? new Date(grace.expiresAt) : null;
  if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
    // Not a grace office and no licence. Nothing to say about it — callers
    // gating on "locked" must not treat this as locked.
    return { ...ZERO, status: "none", licenceActive: false };
  }

  const msLeft = expiresAt.getTime() - now.getTime();
  if (msLeft <= 0) {
    return {
      ...ZERO,
      status: "locked",
      startedAt: grace?.startedAt ?? null,
      expiresAt,
      licenceActive: false,
    };
  }

  const secondsRemaining = Math.floor(msLeft / 1000);
  return {
    status: "grace",
    startedAt: grace?.startedAt ?? null,
    expiresAt,
    secondsRemaining,
    // Ceil so the last partial day reads "1 day left", not "0 days left"
    // while the office still works.
    daysRemaining: Math.ceil(secondsRemaining / 86400),
    licenceActive: false,
    graceDays: OFFICE_GRACE_DAYS,
  };
}

/** The user's existing grace office, if they have one. */
export async function findUserGraceOrg(userId: string) {
  return Organization.findOne({
    "graceProgram.createdByUserId": new Types.ObjectId(userId),
  })
    .select("_id name graceProgram")
    .lean();
}

export type EligibilityReason =
  | "licence"
  | "grace_available"
  | "grace_active"
  | "grace_used";

export interface GraceEligibility {
  canCreate: boolean;
  reason: EligibilityReason;
  licenceActive: boolean;
  /** Set when they already hold a grace office. */
  existing: {
    orgId: string;
    name: string;
    state: GraceState;
  } | null;
  graceDays: number;
}

/**
 * May this user create a starter office through the grace programme?
 *
 *   licence         — they hold a licence; create normally, no grace needed
 *   grace_available — no licence, no grace used yet → allowed, clock starts
 *   grace_active    — already has a grace office, still running → refused
 *   grace_used      — already had one and it lapsed → refused, must buy
 */
export async function checkGraceEligibility(
  userId: string,
  now: Date = new Date()
): Promise<GraceEligibility> {
  const [licence, existingOrg] = await Promise.all([
    getUserPurchase(userId),
    findUserGraceOrg(userId),
  ]);
  const licenceActive = !!licence;

  const existing = existingOrg
    ? {
        orgId: String(existingOrg._id),
        name: (existingOrg as any).name as string,
        state: graceStatusFor(
          (existingOrg as any).graceProgram,
          licenceActive,
          now
        ),
      }
    : null;

  if (licenceActive) {
    return {
      canCreate: true,
      reason: "licence",
      licenceActive: true,
      existing,
      graceDays: OFFICE_GRACE_DAYS,
    };
  }
  if (existing) {
    return {
      canCreate: false,
      reason: existing.state.status === "locked" ? "grace_used" : "grace_active",
      licenceActive: false,
      existing,
      graceDays: OFFICE_GRACE_DAYS,
    };
  }
  return {
    canCreate: true,
    reason: "grace_available",
    licenceActive: false,
    existing: null,
    graceDays: OFFICE_GRACE_DAYS,
  };
}

/** The window a grace office created right now would get. */
export function newGraceWindow(now: Date = new Date()): {
  startedAt: Date;
  expiresAt: Date;
} {
  return {
    startedAt: now,
    expiresAt: new Date(now.getTime() + OFFICE_GRACE_DAYS * 86400 * 1000),
  };
}
