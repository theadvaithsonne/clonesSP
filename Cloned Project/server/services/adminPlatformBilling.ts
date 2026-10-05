import { Types } from "mongoose";
import { Invoice } from "../models/invoice.model";
import { User } from "../models/user.model";
import { createInvoice, getNextChargeDate } from "./invoice";
import { resolveBuyerGstRegion } from "../utils/gstBuyerRegion";
import { applyGstToLine } from "../utils/gstTax";

/**
 * Minting the invoices behind the admin "bill a saved card for a Garage
 * product" action.
 *
 * Kept out of the route so the three products' rules — which are genuinely
 * different and each have a way of failing silently — sit together and are
 * testable without HTTP.
 *
 * ── The silent failure modes these guard ────────────────────────────────
 *  - Unilevel Plus commission reads `invoice.subtotal`, NOT `totalAmount`.
 *    Paying on the GST-inclusive figure over-pays every affiliate by 18%
 *    (this shipped once: a $10.62 direct bonus instead of $9.00).
 *  - A prepaid NetworkChain cycle totals $0, so `metadata.bundle.subUsd` is
 *    the ONLY revenue base the distributor can see. Omit it and everyone is
 *    paid nothing, with no error.
 *  - An Office Pro invoice carrying `razorpaySubscriptionId` makes
 *    `distributeProOfficeCommissionForInvoice` short-circuit as
 *    already-distributed. Never set it here.
 */

export type PlatformItemType = "unilevel_plus" | "third_party" | "office_plan";

export interface MintResult {
  invoice: any;
  /** What the card should be charged. 0 means a free first cycle — don't charge. */
  chargeAmountMinor: number;
  /** Human summary for the Stripe description and the admin's toast. */
  label: string;
}

/** Audit trail stamped on every invoice this file mints. */
export interface AdminActor {
  id: string;
  email: string;
}

function adminMetadata(actor: AdminActor, extra: Record<string, any> = {}) {
  return {
    adminInitiated: true,
    initiatedByGarageAdminId: String(actor.id),
    initiatedByGarageAdminEmail: actor.email,
    ...extra,
  };
}

/**
 * GST on a listed price, resolved from the BUYER's region.
 *
 * Returns the pre-tax base and the tax separately because `createInvoice`
 * takes them separately, and because the base is what commission reads.
 */
async function gstFor(user: any, listedMinor: number) {
  const region = await resolveBuyerGstRegion({ buyerUser: user });
  const line = applyGstToLine({
    listedAmountMinor: listedMinor,
    quantity: 1,
    // Platform prices are quoted ex-GST; tax is added on top.
    gstInclusive: false,
    buyerInIndia: region.inIndia,
  });
  return { base: line.lineUnitPrice, tax: line.taxTotal, total: line.chargeTotal };
}

/**
 * Unilevel Plus — a ONE-TIME licence, never recurring.
 * `UnilevelPlusPurchase.userId` is unique, so this can only ever happen once.
 */
export async function mintUnilevelPlusInvoice(opts: {
  user: any;
  orgId: string;
  actor: AdminActor;
}): Promise<MintResult> {
  const { UNILEVEL_PLUS_PLAN_ID, UNILEVEL_PLUS_PLAN_CONFIG } = await import(
    "../models/unilevelPlusPlan.model"
  );
  const listed = Math.round(Number(UNILEVEL_PLUS_PLAN_CONFIG.productPrice) * 100);
  const { base, tax, total } = await gstFor(opts.user, listed);

  const invoice = await createInvoice({
    organizationId: opts.orgId,
    sellerId: await platformSellerId(),
    userId: String(opts.user._id),
    customerEmail: opts.user.email,
    customerName: opts.user.name,
    lineItems: [
      {
        itemType: "unilevel_plus",
        itemId: UNILEVEL_PLUS_PLAN_ID,
        itemName: "Unilevel Plus",
        quantity: 1,
        // The pre-GST base. `subtotal` derives from this and is what
        // fulfilment distributes on.
        unitPrice: base,
        originalCurrency: UNILEVEL_PLUS_PLAN_CONFIG.currency || "USD",
      },
    ],
    itemCurrency: UNILEVEL_PLUS_PLAN_CONFIG.currency || "USD",
    tax,
    isRecurring: false,
    metadata: adminMetadata(opts.actor, { type: "unilevel_plus_activation" }),
  });

  return { invoice, chargeAmountMinor: total, label: "Unilevel Plus licence" };
}

/**
 * Unilevel Plus licence + the first NetworkChain term, as ONE invoice.
 *
 * Mirrors what `/unilevel-plus/checkout/create-combo-invoice` mints, and for
 * the same reason: `fulfillInvoice` dispatches on `lineItems[0]` and cannot
 * fulfil a mixed-line invoice, so the cart is a single `unilevel_plus` line
 * priced at the whole thing, with `metadata.bundle` telling each distributor
 * which slice is theirs.
 */
export async function mintComboInvoice(opts: {
  user: any;
  orgId: string;
  actor: AdminActor;
  clientId: string;
  productCode?: string;
  termMonths: number;
  subUsd: number;
  licenceUsd: number;
}): Promise<MintResult> {
  const { UNILEVEL_PLUS_PLAN_ID } = await import("../models/unilevelPlusPlan.model");
  const listed = Math.round((opts.licenceUsd + opts.subUsd) * 100);
  const { base, tax, total } = await gstFor(opts.user, listed);

  const invoice = await createInvoice({
    organizationId: opts.orgId,
    sellerId: await platformSellerId(),
    userId: String(opts.user._id),
    customerEmail: opts.user.email,
    customerName: opts.user.name,
    lineItems: [
      {
        itemType: "unilevel_plus",
        itemId: UNILEVEL_PLUS_PLAN_ID,
        itemName: `Unilevel Plus + ${opts.termMonths}-month subscription`,
        quantity: 1,
        unitPrice: base,
        originalCurrency: "USD",
      },
    ],
    itemCurrency: "USD",
    tax,
    isRecurring: false,
    metadata: adminMetadata(opts.actor, {
      type: "unilevel_plus_activation",
      // Read by fulfilment's combo block to issue the subscription.
      combo: {
        thirdPartyClientId: opts.clientId,
        productCode: opts.productCode,
        termMonths: opts.termMonths,
        // Sold after the offer window by definition — an admin is doing this
        // precisely because the buyer missed it. The first cycle is paid.
        freeFirstCycle: false,
      },
      // Load-bearing twice over: `licenceUsd` pins the UP tree to $25 instead
      // of the whole cart (a 2-4x over-payment), and `subUsd` is the revenue
      // base for the subscription leg.
      bundle: {
        licenceUsd: opts.licenceUsd,
        subUsd: opts.subUsd,
        termMonths: opts.termMonths,
      },
    }),
  });

  return {
    invoice,
    chargeAmountMinor: total,
    label: `Unilevel Plus + ${opts.termMonths}-month subscription`,
  };
}

/**
 * Office Pro, billed against one org the user founds.
 *
 * `freeCycles > 0` zeroes the parent, then marks it paid and fulfils it by
 * hand — access now, first real charge next cycle. Doing that by hand is not
 * optional: `createInvoice`'s zero-pay auto-pay branch is gated on the
 * platform-coupon path, so a $0 invoice minted any other way stays `draft`,
 * and `generateDueRecurringInvoices` only chains from a parent that is
 * "paid". Left alone it would grant nothing now AND never bill later.
 */
export async function mintOfficePlanInvoice(opts: {
  user: any;
  orgId: string;
  actor: AdminActor;
  freeCycles: number;
}): Promise<MintResult> {
  const { OFFICE_PLAN_IDS, OFFICE_PLANS_CONFIG } = await import(
    "../models/officePlan.model"
  );
  const plan: any = (OFFICE_PLANS_CONFIG as any).pro;
  const listed = Number(plan.amount) || 0;
  const { base, tax, total } = await gstFor(opts.user, listed);
  const free = opts.freeCycles > 0;

  const invoice = await createInvoice({
    organizationId: opts.orgId,
    sellerId: await platformSellerId(),
    userId: String(opts.user._id),
    customerEmail: opts.user.email,
    customerName: opts.user.name,
    lineItems: [
      {
        itemType: "office_plan",
        // Activation resolves the plan from this id — not from metadata.
        itemId: OFFICE_PLAN_IDS.pro,
        itemName: plan.name || "Founders Office",
        quantity: 1,
        unitPrice: base,
        originalCurrency: plan.currency || "USD",
      },
    ],
    itemCurrency: plan.currency || "USD",
    tax,
    // Cancels the whole cycle to $0 so nothing is charged today. The line
    // item keeps its full price, which is what cycle 2 inherits.
    ...(free ? { discount: base + tax } : {}),
    isRecurring: true,
    recurringPeriod: "monthly",
    metadata: adminMetadata(opts.actor, {
      type: "admin_platform_subscription",
      // Already read by the child generator to force-discount cycles 1..N;
      // it simply had no writers until now.
      ...(opts.freeCycles > 1 ? { trialCyclesTotal: opts.freeCycles } : {}),
    }),
    // NOTE: razorpaySubscriptionId deliberately absent — setting it makes the
    // Pro commission distributor short-circuit as already-distributed.
  });

  invoice.nextDueDate = getNextChargeDate(new Date(), "monthly");
  invoice.recurringPaymentNumber = 1;

  if (free) {
    /**
     * Mark it paid and fulfil it by hand.
     *
     * `createInvoice`'s zero-pay auto-pay branch is gated on the
     * platform-coupon path, so a $0 invoice minted any other way just sits in
     * `draft` — and `generateDueRecurringInvoices` only ever chains from a
     * parent whose status is "paid". Left alone, a free first cycle would
     * grant nothing now AND never bill later. `comboActivation` replicates
     * this same tail for exactly this reason.
     */
    invoice.status = "paid";
    invoice.paidAt = new Date();
    await invoice.save();
    // Access starts now — that is what "first cycle free" means here.
    const { fulfillInvoice } = await import("./invoice");
    await fulfillInvoice(invoice, `admin_free_cycle_${invoice._id}`);
  } else {
    await invoice.save();
  }

  return {
    invoice,
    chargeAmountMinor: free ? 0 : total,
    label: plan.name || "Founders Office",
  };
}

/**
 * The user records revenue against. Platform products are sold by the
 * platform account, not by an org founder.
 */
async function platformSellerId(): Promise<string> {
  const { PLATFORM_USER_EMAIL } = await import("./commission");
  const seller: any = await User.findOne({ email: PLATFORM_USER_EMAIL })
    .select("_id")
    .lean();
  if (!seller) {
    throw new Error(`Platform user ${PLATFORM_USER_EMAIL} not found`);
  }
  return String(seller._id);
}

/** Org to attribute a platform sale to when the product isn't org-scoped. */
export async function platformOrgId(): Promise<string> {
  const { PLATFORM_ORG_ID } = await import("./commission");
  return String(PLATFORM_ORG_ID);
}

/** Has this user already been sold this exact thing? */
export async function findExistingPlatformInvoice(
  userId: string,
  itemType: string,
): Promise<any | null> {
  return Invoice.findOne({
    userId: new Types.ObjectId(userId),
    "lineItems.itemType": itemType,
    status: "paid",
  })
    .sort({ paidAt: -1 })
    .lean();
}
