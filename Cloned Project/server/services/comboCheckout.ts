// src/services/comboCheckout.ts
//
// One implementation of "what does this user pay for a NetworkChain plan right
// now, and what invoice does that produce".
//
// Previously this logic lived inline in POST /unilevel-plus/checkout/
// create-combo-invoice, keyed off `req.user` behind requireAuth. The magic-link
// flow needs exactly the same answers for a user who is NOT logged in (the link
// token identifies them instead), and the product page needs the quote half on
// its own. Three copies of the pricing rules would drift, so they live here.
//
// The two halves:
//   quoteComboCheckout()          — pure read. Safe to call on every page load.
//   createComboCheckoutInvoice()  — mints the invoice the buyer pays.
//
// Nothing here is cached. The offer window is re-resolved on every call, which
// is what makes "the price changes the moment the window lapses" fall out for
// free rather than needing a sweeper.
//
// THREE shapes come out of this, and the difference matters:
//   1. Free claim    — owns the licence, window open. Costs nothing; the caller
//                      activates the free month directly, no invoice at all.
//   2. Combo cart    — no licence. ONE `unilevel_plus` invoice covering licence
//                      + subscription, because fulfilment dispatches on
//                      lineItems[0] and can't fulfil a mixed-line invoice.
//   3. Subscription  — owns the licence, no free month. A plain
//                      `third_party_subscription` invoice. Deliberately NOT the
//                      combo cart: `unilevel_plus` fulfilment parks a redundant
//                      reserve licence and distributes $25 of commission, which
//                      would be paid out of a cart that never charged $25.

import { Types } from "mongoose";
import { User } from "../models/user.model";
import { Invoice, IInvoice } from "../models/invoice.model";
import { IThirdPartyClient } from "../models/thirdPartyClient.model";
import {
  getActiveUnilevelPlusPlan,
  getUserPurchase,
} from "./unilevelPlusCommission";
import { resolveTermPlan } from "./thirdPartyTerms";
import { createThirdPartyInvoice } from "./thirdPartyInvoice";
import { comboWindowFor, ComboWindow } from "./comboWindow";
import { createInvoice } from "./invoice";
import {
  resolveBuyerGstRegion,
  gstSkippedMetadata,
} from "../utils/gstBuyerRegion";
import { applyGstToLine } from "../utils/gstTax";

/** Fields every window/pricing decision reads. Keep projections in sync. */
export const CHECKOUT_USER_FIELDS =
  "email name organizations profileCompletedAt offerExpiresAtOverride";

/** Which of the three purchase shapes this quote describes. */
export type ComboCheckoutKind = "free_claim" | "combo_cart" | "subscription";

export interface ComboQuote {
  kind: ComboCheckoutKind;
  termMonths: number;
  /** Does this purchase carry the free first month? */
  freeMonth: boolean;
  /** Is the $25 licence part of this cart? False when they already own one. */
  includesLicence: boolean;
  licenceUsd: number;
  /** The subscription portion. 0 when the free month alone covers it. */
  subUsd: number;
  /** What the buyer actually pays, before GST. */
  cartUsd: number;
  /** Months of coverage this purchase buys, free month included. */
  monthsOfAccess: number;
  /**
   * What each renewal charges, pre-tax: the term's STANDALONE price, billed
   * every `termMonths` once `monthsOfAccess` runs out. Never the bundle price —
   * renewals don't carry a licence (see priceThirdPartyChildCycle).
   */
  renewalUsd: number;
  currency: string;
  window: ComboWindow;
  comboUsed: boolean;
  ownsLicence: boolean;
  planLabel: string;
  clientName: string;
  productCode: string;
}

export class ComboCheckoutError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "ComboCheckoutError";
  }
}

/**
 * Bundle pricing exists only for a multi-month term bought in the same cart as
 * the licence. A licence owner buying a term on its own gets standalone
 * pricing, and monthly has no bundled tier at all (resolveTermPlan throws).
 */
function resolveSubPlan(
  productConfig: any,
  termMonths: number,
  includesLicence: boolean
) {
  const useBundle = includesLicence && termMonths > 1;
  return resolveTermPlan(
    productConfig,
    termMonths,
    useBundle ? { pricing: "bundle" } : undefined
  );
}

/**
 * Price a NetworkChain plan for a specific user, right now.
 *
 * Read-only and side-effect free, so the magic-link page can call it on every
 * load and the numbers always reflect the live offer state.
 */
export async function quoteComboCheckout(input: {
  userId: string;
  client: IThirdPartyClient;
  termMonths?: number;
  now?: Date;
}): Promise<ComboQuote> {
  const { client, now = new Date() } = input;
  const termMonths = input.termMonths || 1;

  if (!client.productConfig?.recurringPeriod) {
    throw new ComboCheckoutError(
      "client_not_eligible",
      "Third-party client is missing productConfig or is not subscription-enabled.",
      404
    );
  }

  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) {
    throw new ComboCheckoutError(
      "no_active_plan",
      "No active Unilevel Plus plan found",
      404
    );
  }

  const user = await User.findById(input.userId)
    .select(CHECKOUT_USER_FIELDS)
    .lean();
  if (!user) {
    throw new ComboCheckoutError("user_not_found", "User not found", 404);
  }

  // `offerExpiresAtOverride` matters as much as `profileCompletedAt`: an admin
  // extension is what re-opens a lapsed window, and a projection that drops it
  // silently quotes full price to a user who was just granted more time.
  const window = comboWindowFor(user, now);

  const [priorCombo, ownedLicence] = await Promise.all([
    Invoice.findOne({
      userId: new Types.ObjectId(input.userId),
      "metadata.kind": "combo_free_first_month",
    })
      .select({ _id: 1 })
      .lean(),
    getUserPurchase(input.userId),
  ]);

  const comboUsed = !!priorCombo;
  const ownsLicence = !!ownedLicence;
  // One free month per user ever, and only while the window is open.
  const freeMonth = window.open && !comboUsed;
  const includesLicence = !ownsLicence;

  const licenceUsd = plan.productPrice;
  const currency = plan.currency || "USD";

  let kind: ComboCheckoutKind;
  let subUsd = 0;
  let monthsOfAccess: number;
  let planLabel = "Monthly";

  if (ownsLicence && freeMonth) {
    // Nothing to sell: they hold the licence and the free month is still on
    // offer. Identical to POST /checkout/claim-free-month — activate it, and
    // the chosen term bills from cycle 2 via `pendingTermMonths`.
    kind = "free_claim";
    monthsOfAccess = 1;
    if (termMonths > 1) {
      planLabel =
        resolveSubPlan(client.productConfig, termMonths, false).label ||
        `${termMonths} months`;
    }
  } else {
    // Monthly inside the window needs no subscription portion — the free month
    // IS the first cycle. Every other combination is paid for.
    const needsSubPortion = !freeMonth || termMonths > 1;
    if (needsSubPortion) {
      const subPlan = resolveSubPlan(
        client.productConfig,
        termMonths,
        includesLicence
      );
      subUsd = subPlan.sellAmount;
      planLabel = subPlan.label || `${termMonths} months`;
      if (subUsd <= 0) {
        throw new ComboCheckoutError(
          "invalid_term_price",
          `The ${termMonths}-month subscription portion must be greater than $0`
        );
      }
    }
    kind = includesLicence ? "combo_cart" : "subscription";
    // The free month is one month, on top of any prepaid term.
    monthsOfAccess = freeMonth ? 1 + (termMonths > 1 ? termMonths : 0) : termMonths;
  }

  const renewalUsd = resolveTermPlan(client.productConfig, termMonths, {
    allowInactive: true,
  }).standaloneAmount;

  const cartUsd =
    kind === "free_claim"
      ? 0
      : Math.round(((includesLicence ? licenceUsd : 0) + subUsd) * 100) / 100;

  return {
    kind,
    termMonths,
    freeMonth,
    includesLicence,
    licenceUsd,
    subUsd,
    cartUsd,
    monthsOfAccess,
    renewalUsd,
    currency,
    window,
    comboUsed,
    ownsLicence,
    planLabel,
    clientName: client.name,
    productCode: client.productConfig.productCode,
  };
}

/**
 * Quote EVERY active term for one user — the catalog a magic link shows when it
 * wasn't created for a specific plan.
 *
 * Sequential rather than Promise.all: each quote re-reads the same user and
 * plan, so running four in parallel just multiplies identical round trips.
 * A term that fails to resolve is dropped rather than failing the whole
 * catalog, so one misconfigured tier can't take the page down.
 */
export async function quoteAllPlans(input: {
  userId: string;
  client: IThirdPartyClient;
  now?: Date;
}): Promise<ComboQuote[]> {
  const { listActiveTermPlans } = await import("./thirdPartyTerms");
  if (!input.client.productConfig) return [];

  // Standalone listing, because it is the only one that includes the monthly
  // tier — bundle mode filters it out. Per-term pricing is decided inside
  // quoteComboCheckout anyway, which knows whether the licence is in the cart.
  const terms = listActiveTermPlans(input.client.productConfig);
  const out: ComboQuote[] = [];
  for (const t of terms) {
    try {
      out.push(
        await quoteComboCheckout({
          userId: input.userId,
          client: input.client,
          termMonths: t.termMonths,
          now: input.now,
        })
      );
    } catch (err: any) {
      console.error(
        `[ComboCheckout] skipping ${t.termMonths}-month term in catalog: ${err?.message || err}`
      );
    }
  }
  return out.sort((a, b) => a.termMonths - b.termMonths);
}

export interface CreateComboInvoiceResult {
  invoice: IInvoice;
  quote: ComboQuote;
  /** True when an existing unpaid invoice was returned instead of a new one. */
  reused: boolean;
}

/**
 * Mint the invoice for a NetworkChain purchase.
 *
 * Callers MUST check `quote.kind === "free_claim"` first — that shape costs
 * nothing and is activated directly rather than invoiced.
 */
export async function createComboCheckoutInvoice(input: {
  userId: string;
  orgId?: string;
  client: IThirdPartyClient;
  termMonths?: number;
  now?: Date;
}): Promise<CreateComboInvoiceResult> {
  const { client } = input;
  const quote = await quoteComboCheckout(input);

  if (quote.kind === "free_claim") {
    throw new ComboCheckoutError(
      "nothing_to_charge",
      "This purchase costs nothing — activate the free month directly instead of invoicing.",
      409
    );
  }

  const user = await User.findById(input.userId)
    .select(CHECKOUT_USER_FIELDS)
    .lean();
  if (!user?.email) {
    throw new ComboCheckoutError(
      "buyer_not_found",
      "Buyer has no email address",
      404
    );
  }

  // Don't mint a second invoice for a double-click. Only unpaid ones are
  // reusable; a paid invoice means the purchase already happened.
  const existing = await Invoice.findOne({
    userId: new Types.ObjectId(input.userId),
    status: { $in: ["draft", "pending", "sent"] },
    $or: [
      {
        "metadata.combo.thirdPartyClientId": client._id.toString(),
        "metadata.combo.termMonths": quote.termMonths,
      },
      {
        thirdPartyClientId: client._id,
        parentInvoiceId: { $exists: false },
      },
    ],
  }).sort({ createdAt: -1 });
  if (existing) {
    return { invoice: existing, quote, reused: true };
  }

  // ── Shape 3: licence owner buying a subscription on its own ──────────────
  // A plain third-party subscription invoice with a REAL totalAmount. Routing
  // this through the `unilevel_plus` cart instead would park a redundant
  // reserve licence and distribute $25 of commission out of a cart that never
  // charged $25.
  if (quote.kind === "subscription") {
    const invoice = await createThirdPartyInvoice({
      client,
      customerEmail: user.email,
      productCode: quote.productCode,
      termMonths: quote.termMonths,
      externalId: `nc_standalone_${input.userId}_${Date.now()}`,
      metadata: {
        userId: input.userId,
        source: "combo_checkout_subscription",
      },
    });
    return { invoice, quote, reused: false };
  }

  // ── Shape 2: the combo cart (licence + subscription in one invoice) ──────
  const plan = await getActiveUnilevelPlusPlan();
  if (!plan) {
    throw new ComboCheckoutError(
      "no_active_plan",
      "No active Unilevel Plus plan found",
      404
    );
  }

  // The authed route knows the caller's ACTIVE org; the magic-link route has no
  // session, so fall back to the user's first membership.
  const orgId =
    input.orgId || (user as any).organizations?.[0]?.organization?.toString();
  if (!orgId) {
    throw new ComboCheckoutError(
      "no_organization",
      "Buyer does not belong to an organization",
      400
    );
  }

  const cartCents = Math.round(quote.cartUsd * 100);

  // 18% GST on top of the whole cart, gated on the BUYER's country. The
  // subscription cycle spawned at fulfilment carries tax: 0 precisely because
  // the GST for its portion is collected here.
  const gstRegion = await resolveBuyerGstRegion({
    buyerUserId: input.userId,
    paymentCurrency: quote.currency,
  });
  const gstLine = applyGstToLine({
    listedAmountMinor: cartCents,
    gstInclusive: false,
    buyerInIndia: gstRegion.inIndia,
  });

  const sellsSubscription = quote.subUsd > 0;
  const itemName = sellsSubscription
    ? `${plan.name} + ${quote.planLabel} of ${client.name}`
    : plan.name;

  const invoice = await createInvoice({
    organizationId: orgId,
    sellerId: input.userId,
    userId: input.userId,
    customerEmail: user.email,
    lineItems: [
      {
        itemType: "unilevel_plus",
        itemId: plan._id.toString(),
        itemName,
        itemDescription: quote.freeMonth
          ? `$${quote.licenceUsd} Unilevel Plus licence` +
            (sellsSubscription
              ? ` + ${quote.planLabel} ${quote.productCode} subscription ($${quote.subUsd})`
              : "") +
            `, with the first month free`
          : `$${quote.licenceUsd} Unilevel Plus licence + ${quote.planLabel} ${quote.productCode} subscription ($${quote.subUsd})`,
        quantity: 1,
        unitPrice: cartCents,
        originalCurrency: quote.currency,
      },
    ],
    itemCurrency: quote.currency,
    tax: gstLine.taxTotal,
    metadata: {
      type: "unilevel_plus_activation",
      quantity: 1,
      combo: {
        thirdPartyClientId: client._id.toString(),
        productCode: quote.productCode,
        clientName: client.name,
        termMonths: quote.termMonths,
        // Decided HERE, at checkout, and carried through fulfilment.
        // Re-evaluating the window at fulfilment time would let a payment that
        // took longer than the remaining window silently lose the free month
        // the buyer was quoted.
        freeFirstCycle: quote.freeMonth,
        offerWindowExpiresAt: quote.window.expiresAt?.toISOString(),
      },
      // BUNDLE SPLIT — load-bearing in two places:
      //   1. fulfillInvoice's `unilevel_plus` case reads `licenceUsd` to pin UP
      //      commission to $25 rather than the cart total.
      //   2. comboActivation reads `subUsd` to mint the prepaid cycle and to
      //      tell the distributor what revenue to split.
      ...(sellsSubscription
        ? {
            bundle: {
              licenceUsd: quote.licenceUsd,
              subUsd: quote.subUsd,
              termMonths: quote.termMonths,
              thirdPartyClientId: client._id.toString(),
            },
          }
        : {}),
      ...(gstLine.gstMetadata
        ? {
            gst: {
              ...gstLine.gstMetadata,
              buyerCountry: gstRegion.country,
              buyerRegion: "IN" as const,
              regionSource: gstRegion.source,
            },
          }
        : {
            gstSkipped: gstSkippedMetadata(gstRegion, "buyer_outside_india"),
          }),
    },
  });

  return { invoice, quote, reused: false };
}
