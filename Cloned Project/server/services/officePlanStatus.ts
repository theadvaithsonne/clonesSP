// Per-org office plan status — resolves an org's CURRENT plan (Starter
// / Pro / etc.) plus its Cryptosub add-on state. Used by:
//
//   POST /org/:orgId/cryptobrand-upgrade — gates on "is Starter?" to
//     decide whether to mint Pro + Cryptosub bootstrap invoices.
//   GET  /me/offices/plans — lists every founder org with its plan info
//     for the "my crypto offices" grid.
//
// Not to be confused with services/cryptobrandCheckoutStatus.ts —
// that one gates on "is the bootstrap INVOICE paid?", which is a
// different question (an org can be on Starter with a paid Pro
// invoice sitting in history, or on Pro with no bootstrap invoice
// at all if they came in via the standard office checkout).

import { Types } from "mongoose";
import { OfficeSubscription } from "../models/officeSubscription.model";
import { OfficePlan } from "../models/officePlan.model";
import { hasActiveAddon } from "./officeAddonSubscription";
import { isProOfficeSatisfied } from "./cryptobrandCheckoutStatus";
import { CRYPTOSUB_ADDON } from "../config/cryptosubAddon";

export interface OfficePlanStatus {
  orgId: string;
  /** null when the org has no OfficeSubscription doc at all. */
  planSlug: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  isTrial: boolean;
  /** True when Cryptosub add-on is active on this org. */
  cryptosubActive: boolean;
  /** Convenience: true when the org is NOT on Pro. */
  needsUpgradeToPro: boolean;
  isCryptobrand: boolean;
}

/**
 * Look up the ACTIVE plan for an org.
 *
 * The primary source of truth here is the INVOICE ledger, not the
 * `OfficeSubscription` collection — the platform pays Pro via
 * wallet/crypto invoices, not Razorpay-hosted subscriptions.
 * `OfficeSubscription` docs exist as stubs from the old office
 * checkout, but the cryptobrand-bootstrap wallet-pay path never
 * activates one; only the paid `office_plan` invoice records that Pro
 * was purchased.
 *
 * We still fall back to OfficeSubscription for the rare legacy flows
 * that DID activate one (some pre-cryptobrand orgs). If neither says
 * Pro, `needsUpgradeToPro` reads true and the founder can hit
 * `POST /org/:orgId/cryptobrand-upgrade` to buy it.
 *
 * The pre-fix version checked only OfficeSubscription, so every
 * cryptobrand founder who paid via wallet came back as
 * `planSlug: null → needsUpgradeToPro: true`, letting the upgrade
 * endpoint re-mint Pro invoices repeatedly. The invoice-first check
 * below closes that hole.
 */
export async function getOfficePlanStatusForOrg(
  orgId: string,
  isCryptobrand: boolean,
): Promise<OfficePlanStatus> {
  const orgOid = new Types.ObjectId(orgId);

  const [sub, proInvoicePaid]: [any, boolean] = await Promise.all([
    // Legacy fallback — only some pre-cryptobrand orgs have an
    // activated OfficeSubscription; wallet-pay flows don't.
    OfficeSubscription.findOne({
      orgId: orgOid,
      status: {
        $in: [
          "active",
          "trial",
          "authenticated",
          "created",
          "pending",
          "halted",
        ],
      },
    })
      .select("planId status isTrial")
      .lean(),
    // Primary source of truth — the paid Pro invoice from the
    // cryptobrand-bootstrap flow. Cheap `Invoice.exists` behind the
    // scenes; matches on `metadata.source: "cryptobrand_bootstrap"` +
    // `metadata.planSlug: "pro"`.
    isProOfficeSatisfied(orgId),
  ]);

  let planSlug: string | null = null;
  let planName: string | null = null;
  if (sub?.planId) {
    const plan: any = await OfficePlan.findById(sub.planId)
      .select("slug name")
      .lean();
    planSlug = plan?.slug || null;
    planName = plan?.name || null;
  }

  // If the invoice lane says Pro but the subscription lane didn't
  // resolve to Pro, treat the org as on Pro. Order matters: an
  // OfficeSubscription with `starter` planSlug and a paid bootstrap
  // invoice means Pro (the invoice supersedes the leftover starter).
  if (!planSlug || planSlug !== "pro") {
    if (proInvoicePaid) {
      planSlug = "pro";
      planName = planName || "Pro";
    }
  }

  const cryptosubActive = await hasActiveAddon(orgId, CRYPTOSUB_ADDON.slug);

  return {
    orgId,
    planSlug,
    planName,
    subscriptionStatus: sub?.status || null,
    isTrial: !!sub?.isTrial,
    cryptosubActive,
    // "Not Pro" covers both Starter and no-subscription-at-all states,
    // so the founder can hit /cryptobrand-upgrade to fix it.
    needsUpgradeToPro: planSlug !== "pro",
    isCryptobrand,
  };
}
