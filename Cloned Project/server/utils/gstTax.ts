// Tax math + policy helpers shared by every paid-item checkout flow.
//
// The arithmetic primitives (`extractBaseFromTotal`, `calculateTaxAmounts`,
// `GST_CONFIG`) were originally co-located with the OfficePlan model — moved
// here so channels, courses, products, etc. can reuse them without importing
// from a model file. The original location re-exports these for back-compat.

// GST configuration — single source of truth for the rate.
// Razorpay subscription plans pass `tax_inclusive: true` so they charge
// exactly the amount we send (base + GST), not base inflated by another 18%.
export const GST_CONFIG = {
  rate: 18, // 18% GST
  sacCode: "998314", // SAC code for IT/SaaS services
  taxInclusive: true,
};

// All amounts here are in the SMALLEST UNIT (paise for INR, cents for USD).
// Rounding always to integers — Razorpay rejects fractional paise.

/**
 * Tax is added ON TOP of the base. Use when the founder enters the pre-tax
 * price (i.e. `gstInclusive: false`).
 *   in:  baseAmountPaise = 10000  → 100 INR base
 *   out: { baseAmount: 10000, taxAmount: 1800, totalAmount: 11800, taxRate: 18 }
 */
export function calculateTaxAmounts(
  baseAmountPaise: number,
  taxRate: number = GST_CONFIG.rate,
) {
  const taxAmount = Math.round((baseAmountPaise * taxRate) / 100);
  const totalAmount = baseAmountPaise + taxAmount;
  return { baseAmount: baseAmountPaise, taxAmount, totalAmount, taxRate };
}

/**
 * Tax is split OUT of the listed price. Use when the founder enters a
 * gross/total price they want the buyer to actually pay (i.e. `gstInclusive: true`).
 *   in:  totalAmountPaise = 11800  → 118 INR total
 *   out: { baseAmount: 10000, taxAmount: 1800, totalAmount: 11800, taxRate: 18 }
 */
export function extractBaseFromTotal(
  totalAmountPaise: number,
  taxRate: number = GST_CONFIG.rate,
) {
  const baseAmount = Math.round(totalAmountPaise / (1 + taxRate / 100));
  const taxAmount = totalAmountPaise - baseAmount;
  return { baseAmount, taxAmount, totalAmount: totalAmountPaise, taxRate };
}

// Apple App Store fee — flat 30% on iOS in-app purchases. Same shape as
// the GST helpers so call sites can use whichever pattern matches the
// founder's `appleFeeInclusive` choice.
export const APPLE_FEE_RATE = 30;

export function calculateAppleFeeOnTop(
  baseAmountPaise: number,
  rate: number = APPLE_FEE_RATE,
) {
  const fee = Math.round((baseAmountPaise * rate) / 100);
  return { baseAmount: baseAmountPaise, feeAmount: fee, totalAmount: baseAmountPaise + fee };
}

export function extractAppleFeeFromTotal(
  totalAmountPaise: number,
  rate: number = APPLE_FEE_RATE,
) {
  const baseAmount = Math.round(totalAmountPaise / (1 + rate / 100));
  const feeAmount = totalAmountPaise - baseAmount;
  return { baseAmount, feeAmount, totalAmount: totalAmountPaise };
}

// ── Per-item POLICY ────────────────────────────────────────────────────

/**
 * DEPRECATED as the gate for founder-sold sellable items (channels,
 * courses, workshops, products). Those now gate on the BUYER's country —
 * see `applyGstToLine` below and `utils/gstBuyerRegion.ts`.
 *
 * Still the live rule for the Unilevel Plus track
 * (services/unilevelPlusCommission.ts), which has not been migrated to
 * buyer-location gating. Do not add new callers.
 */
export function shouldApplyGstForChannel(channel: { currency?: string | null }): boolean {
  return (channel.currency || "").toUpperCase() === "INR";
}

/**
 * Is this country string India? Tolerant of the shapes actually present in
 * our data: `country` is free text on User profiles and shipping addresses
 * (users type "India"), while payment-options callers pass ISO "IN".
 * Mirrors the tolerance already used for UPI gating in services/invoice.ts.
 *
 * Empty/absent is NOT India — callers must decide their own fallback
 * (checkout falls back to payment currency).
 */
export function isIndiaCountry(value?: string | null): boolean {
  const v = String(value || "").trim().toUpperCase();
  return v === "IN" || v === "INDIA";
}

// ── Buyer-location GST for founder-sold items ──────────────────────────

export interface GstLineResult {
  /** Pre-tax base, per unit. Goes on the invoice line item's `unitPrice`. */
  lineUnitPrice: number;
  /** Tax for the whole line (already multiplied by quantity). */
  taxTotal: number;
  /** What the buyer actually pays for this line, incl. tax. */
  chargeTotal: number;
  /** Present only when tax was actually applied. */
  gstMetadata?: {
    rate: number;
    amount: number;
    inclusive: boolean;
    sacCode: string;
  };
}

/**
 * The single place the GST matrix lives. Every founder-sold checkout
 * (channel / course / workshop / product, one-time and recurring) routes
 * through here.
 *
 * Two independent layers:
 *   Layer 1 — the founder answered "does my listed price include GST?"
 *             (`gstInclusive`), asked for every item regardless of currency.
 *   Layer 2 — GST is only owed when the BUYER is in India (`buyerInIndia`),
 *             resolved by utils/gstBuyerRegion.ts. Currency does not gate.
 *
 * Per unit:
 *
 *   inclusive + India    → base = listed/1.18, tax = listed − base, pays listed
 *   inclusive + foreign  → base = listed,      tax = 0,             pays listed
 *   exclusive + India    → base = listed,      tax = listed×18%,    pays listed×1.18
 *   exclusive + foreign  → base = listed,      tax = 0,             pays listed
 *   exempt (any)         → base = listed,      tax = 0,             pays listed
 *
 * Note the inclusive+foreign row: the buyer pays the same sticker price
 * everywhere, and the full amount is booked as base (the founder keeps the
 * 18% that would otherwise have been remitted). This is deliberate — see
 * the GST plan. It also means the commission base for a foreign inclusive
 * sale is 18% higher than for the same sale to an Indian buyer.
 *
 * `listedAmountMinor` is per-unit in the smallest unit (paise/cents).
 */
export function applyGstToLine(opts: {
  listedAmountMinor: number;
  quantity?: number;
  gstInclusive: boolean;
  buyerInIndia: boolean;
  /** Item-level exemption (e.g. bat246 entries are priced net of tax). */
  exempt?: boolean;
  taxRate?: number;
}): GstLineResult {
  const quantity = opts.quantity ?? 1;
  const rate = opts.taxRate ?? GST_CONFIG.rate;
  const listed = opts.listedAmountMinor;

  // No GST owed: buyer is outside India, or the item is exempt. The listed
  // price is the base in BOTH inclusive and exclusive cases.
  if (opts.exempt || !opts.buyerInIndia) {
    return {
      lineUnitPrice: listed,
      taxTotal: 0,
      chargeTotal: listed * quantity,
    };
  }

  if (opts.gstInclusive) {
    // Listed price already contains the tax → split it out.
    const { baseAmount, taxAmount } = extractBaseFromTotal(listed, rate);
    return {
      lineUnitPrice: baseAmount,
      taxTotal: taxAmount * quantity,
      chargeTotal: listed * quantity,
      gstMetadata: {
        rate,
        amount: taxAmount * quantity,
        inclusive: true,
        sacCode: GST_CONFIG.sacCode,
      },
    };
  }

  // Listed price excludes tax → add it on top.
  const { taxAmount } = calculateTaxAmounts(listed, rate);
  return {
    lineUnitPrice: listed,
    taxTotal: taxAmount * quantity,
    chargeTotal: (listed + taxAmount) * quantity,
    gstMetadata: {
      rate,
      amount: taxAmount * quantity,
      inclusive: false,
      sacCode: GST_CONFIG.sacCode,
    },
  };
}

/**
 * Apple's 30% fee applies whenever the buyer is paying via the iOS app.
 * Web/Android purchases never carry it.
 */
export function shouldApplyAppleFee(paymentSource?: string | null): boolean {
  return paymentSource === "ios";
}

/**
 * Commission base for a sold item, in MAIN units (not paise/cents).
 *
 * Affiliates are paid on the pre-tax base — GST is the government's, not
 * the seller's. The only case needing extraction is an inclusive-priced
 * item sold to an Indian buyer, where the listed price contains the 18%.
 *
 * Every other combination returns the listed price unchanged, including
 * inclusive + foreign buyer: no GST was collected there, so the whole
 * listed price is base (and commissions are correspondingly 18% larger
 * than on the same sale to an Indian buyer — deliberate, see the plan).
 *
 * `buyerInIndia` comes from resolveBuyerGstRegion() and is required so no
 * caller can silently fall back to the old currency-based rule.
 *
 * Shared across every distributeCommissions callsite (workshops, courses,
 * products, channels).
 */
export function getCommissionBase(
  listedPrice: number,
  item: { gstInclusive?: boolean | null },
  buyerInIndia: boolean
): number {
  if (buyerInIndia && item.gstInclusive) {
    return (
      extractBaseFromTotal(Math.round(listedPrice * 100)).baseAmount / 100
    );
  }
  return listedPrice;
}
