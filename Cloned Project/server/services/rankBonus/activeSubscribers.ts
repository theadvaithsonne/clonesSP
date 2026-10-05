// src/services/rankBonus/activeSubscribers.ts
//
// "Who holds an active PAID NetworkChain subscription right now?"
//
// This is the single most dangerous predicate in the rank-bonus system: it
// decides who earns money. Three sources were considered and two rejected.
//
//   NcSubscription mirror  — REJECTED. Owned by contacts-backend, not us. One
//     document per user, mutated in place. Its `payments.$elemMatch.amountCents
//     > 0` test asks "has this user EVER paid", not "is the current period
//     paid". And Garage sends `amount: invoice.totalAmount` on the webhook,
//     which is 0 for a bundle-prepaid cycle — so a 6-month combo buyer likely
//     records `amountCents: 0` there and would be wrongly excluded.
//
//   User.typeFlags.networkChainsSub — REJECTED. A cached boolean with no expiry
//     sweeper: nothing recomputes it when a subscription simply lapses, so it
//     is stale-positive. It also inherits the bundle-prepaid flaw above.
//
//   Invoice — USED. We own it, it is append-only, and the chain root's
//     `nextDueDate` is re-stamped on every payment, making it an accurate
//     "covered until" pointer for a point-in-time question.
//
// THE TRAP: `totalAmount > 0` is NOT a "was this paid" test. A term bought
// inside the $25 Unilevel Plus cart is minted with `totalAmount: 0` because the
// cash landed on the UP invoice — see the carve-out at services/invoice.ts in
// the third_party_subscription fulfilment branch. Filtering those out would
// disqualify every 3/6/12-month combo buyer for their entire prepaid term.
// `metadata.prepaidViaBundle` is what distinguishes them from a genuinely free
// cycle.

import { Types } from "mongoose";
import { Invoice } from "../../models/invoice.model";
import { User } from "../../models/user.model";
import { PLATFORM_USER_EMAIL } from "../commission";

/** Cycle kinds that are never subscription revenue. */
const NON_SUBSCRIPTION_KINDS = ["topup", "combo_free_first_month"];

export interface ActiveSubscriberResult {
  /** userIds (as strings) holding an active paid subscription at `asOf`. */
  active: Set<string>;
  /** Chain roots that are still covered but have only ever had a free cycle. */
  freeOnlyCount: number;
  /** Chain roots currently covered, before the paid-cycle filter. */
  coveredChains: number;
}

/**
 * Snapshot of active PAID subscribers for one partner.
 *
 * Point-in-time by design — the rank period's eligibility rule is "active when
 * the payout runs", so no historical reconstruction is needed. That matters:
 * `metadata.periodStart/periodEnd` only landed recently and was never
 * backfilled, so a retrospective query would be unreliable on older rows.
 */
export async function getActivePaidSubscribers(
  thirdPartyClientId: Types.ObjectId | string,
  asOf: Date = new Date()
): Promise<ActiveSubscriberResult> {
  const clientId =
    typeof thirdPartyClientId === "string"
      ? new Types.ObjectId(thirdPartyClientId)
      : thirdPartyClientId;

  // ── 1. Chains still covered at `asOf` ────────────────────────────────────
  // Coverage is carried by the LATEST paid invoice in the chain, NOT the root.
  // Renewal advances a CHILD invoice's nextDueDate (services/invoice.ts: the
  // cron mints one child per cycle and applyPaidInvoice stamps the new date on
  // that child; the cascade chains off `latestChild.nextDueDate`). The root keeps
  // its first-cycle date forever — so a renewed subscriber's root sits in the
  // past while a paid child still covers them, and checking the root alone
  // wrongly reads every renewed member as lapsed. Resolve each still-covering
  // PAID, non-cancelled invoice (root OR cycle) to its chain root.
  const covering = await Invoice.find({
    "lineItems.itemType": "third_party_subscription",
    thirdPartyClientId: clientId,
    status: "paid",
    cancelledAt: { $in: [null, undefined] },
    nextDueDate: { $gt: asOf },
  })
    .select({ _id: 1, parentInvoiceId: 1 })
    .lean();

  const coveredRootIds = new Set<string>();
  for (const inv of covering) {
    coveredRootIds.add((inv.parentInvoiceId ?? inv._id).toString());
  }
  if (coveredRootIds.size === 0) {
    return { active: new Set(), freeOnlyCount: 0, coveredChains: 0 };
  }

  // Load the chain roots (userId + covered-chain count). Exclude chains whose
  // ROOT is cancelled even if a stray cycle wasn't — matches the prior
  // "cancelled chains never count" behaviour.
  const roots = await Invoice.find({
    _id: { $in: [...coveredRootIds].map((id) => new Types.ObjectId(id)) },
    cancelledAt: { $in: [null, undefined] },
  })
    .select({ _id: 1, userId: 1 })
    .lean();

  if (roots.length === 0) {
    return { active: new Set(), freeOnlyCount: 0, coveredChains: 0 };
  }

  const rootIds = roots.map((r) => r._id);

  // ── 2. Of those chains, which have ever had a REAL paid cycle? ───────────
  // A user whose only invoice is the $25-combo free month is covered (step 1
  // passes) but has paid nothing, and must not qualify. The user's rule is that
  // eligibility starts from the second month — this is that guard.
  //
  // "Real" = paid, not a top-up, not the free month, and either it collected
  // cash OR it is a bundle-prepaid cycle (cash collected on the UP invoice).
  const paidChains = await Invoice.find({
    status: "paid",
    // $nin also matches documents where `kind` is absent, which is the common
    // case for an ordinary paid cycle.
    "metadata.kind": { $nin: NON_SUBSCRIPTION_KINDS },
    $and: [
      // belongs to one of the covered chains (root itself, or any of its cycles)
      { $or: [{ _id: { $in: rootIds } }, { parentInvoiceId: { $in: rootIds } }] },
      // and represents real revenue — cash collected here, OR collected on the
      // UP invoice for a bundle-prepaid term (which carries totalAmount: 0)
      {
        $or: [
          { totalAmount: { $gt: 0 } },
          { "metadata.prepaidViaBundle": { $exists: true } },
        ],
      },
    ],
  })
    .select({ _id: 1, parentInvoiceId: 1 })
    .lean();

  const paidRootIds = new Set<string>();
  for (const inv of paidChains) {
    paidRootIds.add(
      (inv.parentInvoiceId ? inv.parentInvoiceId : inv._id).toString()
    );
  }

  const active = new Set<string>();
  for (const r of roots) {
    if (paidRootIds.has(r._id.toString()) && r.userId) {
      active.add(r.userId.toString());
    }
  }

  // The platform account is always treated as an active subscriber, matching
  // how it is already always treated as licence-holding in
  // wallet.ts:creditAffiliateOrPlatform and unilevel-plus.ts's product route.
  // It is the destination for platform revenue, so requiring it to invoice
  // itself to stay "active" is circular.
  const platform = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select({ _id: 1 })
    .lean();
  if (platform) active.add(platform._id.toString());

  return {
    active,
    coveredChains: roots.length,
    freeOnlyCount: roots.length - paidRootIds.size,
  };
}
