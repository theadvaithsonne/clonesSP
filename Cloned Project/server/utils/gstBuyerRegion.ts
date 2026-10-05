// Resolves WHERE the buyer is, for GST purposes.
//
// GST on founder-sold items is owed based on the buyer's location, not the
// item's currency (see utils/gstTax.ts `applyGstToLine`). This module is the
// only place that decision reads the database; gstTax.ts stays pure.

import { isIndiaCountry } from "./gstTax";
import { resolveBuyerAddress } from "./buyerAddress";

export type GstRegionSource =
  | "shipping"
  | "billing"
  | "profile"
  | "profile_pincode"
  | "profile_state"
  | "org"
  | "payment_currency";

// 28 states + 8 UTs. Loose-matched (case-insensitive, punctuation-stripped)
// against the buyer's `state` field. Only used as a country-implying signal
// when `country` is missing from the profile — a Delhi resident whose User
// doc has state="Delhi" but country=null is unambiguously in India.
const INDIAN_STATES_NORMALISED = new Set(
  [
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh",
    "goa", "gujarat", "haryana", "himachal pradesh", "jharkhand", "karnataka",
    "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya",
    "mizoram", "nagaland", "odisha", "orissa", "punjab", "rajasthan",
    "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh",
    "uttarakhand", "west bengal",
    // Union territories
    "andaman and nicobar islands", "chandigarh",
    "dadra and nagar haveli and daman and diu",
    "delhi", "nct of delhi", "national capital territory of delhi",
    "jammu and kashmir", "ladakh", "lakshadweep", "puducherry", "pondicherry",
  ]
);

function normaliseState(s: string): string {
  return s.trim().toLowerCase().replace(/[.,]/g, "").replace(/\s+/g, " ");
}

/** Indian PIN codes are always exactly 6 digits, first digit ∈ 1..8. */
function looksLikeIndianPincode(pc: string): boolean {
  return /^[1-8]\d{5}$/.test(pc.trim());
}

export interface BuyerGstRegion {
  inIndia: boolean;
  /** The country string we resolved, verbatim. Null when we fell back. */
  country: string | null;
  source: GstRegionSource;
}

/**
 * Resolve the buyer's GST region.
 *
 * Precedence (via resolveBuyerAddress — shipping → billing → profile, first
 * candidate carrying a non-empty country wins):
 *
 *   1. Shipping address on this checkout (physical goods only)
 *   2. Billing address (third-party / ecommerce API)
 *   3. The buyer's User profile country
 *   4. FALLBACK: the currency the buyer chose to pay in — INR ⇒ India.
 *
 * Step 4 exists because most checkouts (channel / course / workshop) collect
 * only email + OTP + name, and guest checkout creates the User with no
 * profile fields at all. For those buyers the payment currency is the only
 * buyer-made signal available. A resolved country ALWAYS wins over it.
 *
 * Pass `buyerUser` when the caller already has the User doc (most checkout
 * routes do) to avoid a redundant query; otherwise pass `buyerUserId`.
 */
export async function resolveBuyerGstRegion(opts: {
  buyerUser?: any;
  buyerUserId?: string;
  shippingAddress?: any;
  billingAddress?: any;
  paymentCurrency?: string | null;
}): Promise<BuyerGstRegion> {
  let buyerUser = opts.buyerUser;

  if (!buyerUser && opts.buyerUserId) {
    try {
      const { User } = await import("../models/user.model");
      buyerUser = await User.findById(opts.buyerUserId)
        .select("country state city postalCode")
        .lean();
    } catch {
      // Non-fatal — we simply fall through to the currency fallback.
      buyerUser = null;
    }
  }

  // resolveBuyerAddress takes loose objects by design, so a synthetic
  // invoice-shaped object works before the invoice actually exists.
  const address = resolveBuyerAddress(
    {
      shippingAddress: opts.shippingAddress,
      billingAddress: opts.billingAddress,
    },
    buyerUser
  );

  if (address?.country) {
    // Which candidate did it come from? resolveBuyerAddress returns the first
    // whose country is non-blank AFTER trimming, so the re-derivation has to
    // use the same test — a whitespace-only country is truthy but skipped,
    // and would otherwise mislabel the audit trail.
    const hasCountry = (a: any) =>
      !!a?.country && String(a.country).trim().length > 0;

    let source: GstRegionSource = "profile";
    if (hasCountry(opts.shippingAddress)) source = "shipping";
    else if (hasCountry(opts.billingAddress)) source = "billing";

    return {
      inIndia: isIndiaCountry(address.country),
      country: String(address.country).trim(),
      source,
    };
  }

  // ─── Country-implying profile signals (defensive) ─────────────────
  // Some checkout paths (NC "combo" flow, garage-store, admin-created
  // users) create the User doc with pincode/state/city but WITHOUT a
  // country string. resolveBuyerAddress skips those (needs a country),
  // and we'd otherwise fall through to the payment-currency signal —
  // which routinely lies for USD-listed items bought by Indian buyers
  // (Razorpay converts INR at checkout but the caller often passes the
  // plan currency here).
  //
  // Careful with false positives: a 6-digit postcode collides with
  // Chinese addresses, so we ONLY accept pincode as an India signal
  // when the buyer's state is either empty OR itself matches an Indian
  // state. A foreign state name always wins over the pincode heuristic.
  // A recognised Indian state name alone (no pincode) is trusted too —
  // "Andhra Pradesh" isn't a valid state name anywhere else.
  const pincode = (buyerUser?.postalCode || "").toString().trim();
  const state = (buyerUser?.state || "").toString().trim();
  const pincodeLooksIndian = pincode.length > 0 && looksLikeIndianPincode(pincode);
  const stateLooksIndian = state.length > 0 && INDIAN_STATES_NORMALISED.has(normaliseState(state));
  const stateSetAndForeign = state.length > 0 && !stateLooksIndian;

  if (pincodeLooksIndian && !stateSetAndForeign) {
    return {
      inIndia: true,
      country: "India",
      source: "profile_pincode",
    };
  }
  if (stateLooksIndian && !pincode) {
    return {
      inIndia: true,
      country: "India",
      source: "profile_state",
    };
  }

  return {
    inIndia: (opts.paymentCurrency || "").toUpperCase() === "INR",
    country: null,
    source: "payment_currency",
  };
}

/**
 * Resolve the GST region for an ORG-level purchase — office plans, office
 * add-ons, conference rooms. The entity being billed is the organization,
 * not the person clicking subscribe, so its own country leads:
 *
 *   1. Organization.country (free text — "India" and "IN" both handled)
 *   2. The subscribing user's profile, via resolveBuyerGstRegion
 *   3. FALLBACK: payment currency
 *
 * Unlike sellable items these tracks are platform fees and are ALWAYS
 * exclusive (GST added on top) — only applicability varies by region.
 */
export async function resolveOrgGstRegion(opts: {
  orgId?: string | null;
  subscriberUserId?: string | null;
  paymentCurrency?: string | null;
}): Promise<BuyerGstRegion> {
  if (opts.orgId) {
    try {
      const { Organization } = await import("../models/organization.model");
      const org = await Organization.findById(opts.orgId)
        .select("country")
        .lean();
      const country = (org as any)?.country;
      if (country && String(country).trim().length > 0) {
        return {
          inIndia: isIndiaCountry(country),
          country: String(country).trim(),
          source: "org",
        };
      }
    } catch {
      // Non-fatal — fall through to the subscriber's own profile.
    }
  }

  return resolveBuyerGstRegion({
    buyerUserId: opts.subscriberUserId || undefined,
    paymentCurrency: opts.paymentCurrency,
  });
}

/**
 * Convenience for commission sites, which run at payment-verification time
 * and only have a userId + the item's currency. Resolves the same way
 * checkout did (profile country, else currency), so the commission base
 * matches the base that was invoiced.
 */
export async function isBuyerInIndia(
  userId: string,
  fallbackCurrency?: string | null
): Promise<boolean> {
  const region = await resolveBuyerGstRegion({
    buyerUserId: userId,
    paymentCurrency: fallbackCurrency,
  });
  return region.inIndia;
}

/**
 * Build the `metadata.gstSkipped` marker stamped on invoices where no GST
 * was charged. Without it there is no way to tell a correctly-exempt
 * foreign sale from a gate that misfired.
 */
export function gstSkippedMetadata(
  region: BuyerGstRegion,
  reason: "buyer_outside_india" | "item_exempt"
) {
  return {
    reason,
    buyerCountry: region.country,
    regionSource: region.source,
  };
}
