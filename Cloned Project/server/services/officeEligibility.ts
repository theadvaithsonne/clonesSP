// src/services/officeEligibility.ts
//
// One rule, one place: you need an active Unilevel Plus licence to create an
// office.
//
// Both org-creating endpoints (`POST /org/create-first-time` and
// `POST /org/upsert`) call this. Gating only the first would leave the second
// as an open bypass — it requires a JWT but carries no business guard and no
// frontend caller, so nothing would surface the hole.
//
// The check is deliberately NOT a fifth copy of the
// `UnilevelPlusPurchase.findOne({ status: "active" })` query that already
// exists in four files. It delegates to `getUserPurchase`, the canonical helper
// the product route and comboCheckout both use, so a future change to what
// "owns a licence" means lands here too.

import {
  getUserPurchase,
  getActiveUnilevelPlusPlan,
} from "./unilevelPlusCommission";
import { PLATFORM_USER_EMAIL } from "./commission";
import { User } from "../models/user.model";

export class OfficeEligibilityError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 403,
    public details: Record<string, any> = {}
  ) {
    super(message);
    this.name = "OfficeEligibilityError";
  }
}

export interface OfficeEligibility {
  allowed: boolean;
  /** Why they're allowed — useful in logs when something looks wrong. */
  reason: "licence" | "platform_user" | "no_licence";
}

/**
 * Non-throwing form, for callers that want to render rather than reject.
 */
export async function checkCanCreateOffice(
  userId: string
): Promise<OfficeEligibility> {
  // The platform account is treated as always licence-holding everywhere else
  // in the codebase (wallet.ts:creditAffiliateOrPlatform, the UP product
  // route), and it is the account that owns the platform's own orgs. Excluding
  // it here would be an inconsistency that only shows up as a confusing 403.
  const user = await User.findById(userId).select("email").lean();
  if (user?.email === PLATFORM_USER_EMAIL) {
    return { allowed: true, reason: "platform_user" };
  }

  const licence = await getUserPurchase(userId);
  return licence
    ? { allowed: true, reason: "licence" }
    : { allowed: false, reason: "no_licence" };
}

/**
 * Throwing form for route handlers.
 *
 * The thrown error carries a stable `code` so the frontend can distinguish
 * "buy a licence" from every other 403 and open the purchase drawer rather than
 * showing a generic failure.
 */
export async function assertCanCreateOffice(userId: string): Promise<void> {
  const result = await checkCanCreateOffice(userId);
  if (result.allowed) return;

  // Price read from the live plan rather than hardcoded, so the message can
  // never quote a figure the checkout doesn't charge. Only runs on the reject
  // path, so it costs nothing in the normal case.
  const plan = await getActiveUnilevelPlusPlan();

  throw new OfficeEligibilityError(
    "licence_required",
    "A Unilevel Plus licence is required to create an office.",
    403,
    {
      licencePriceUsd: plan?.productPrice ?? null,
      currency: plan?.currency ?? "USD",
    }
  );
}

/** Shape an OfficeEligibilityError into the JSON body both routes return. */
export function eligibilityErrorBody(err: OfficeEligibilityError) {
  return {
    error: err.code,
    message: err.message,
    ...err.details,
  };
}
