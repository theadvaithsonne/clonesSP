import { AddressInput } from "./territoryResolver";

/**
 * Resolve the buyer's geographic address for founder-program commission
 * attribution (buyer-location based). Priority:
 *
 *   1. Invoice shipping address (set on physical / ecommerce checkouts)
 *   2. Invoice billing address
 *   3. The buyer's User profile (country/state/city/postalCode)
 *
 * Returns null when no usable address exists (the distributor then no-ops —
 * no attribution, slice stays with the founder).
 *
 * `invoice` and `buyerUser` are passed as loose objects so callers can hand in
 * lean docs or hydrated mongoose docs without coupling to a type.
 */
export function resolveBuyerAddress(
  invoice: any,
  buyerUser: any
): AddressInput | null {
  const fromShipping = invoice?.shippingAddress;
  const fromBilling = invoice?.billingAddress;

  const candidates: AddressInput[] = [];
  if (fromShipping) {
    candidates.push({
      country: fromShipping.country,
      state: fromShipping.state,
      city: fromShipping.city,
      postalCode: fromShipping.postalCode,
    });
  }
  if (fromBilling) {
    candidates.push({
      country: fromBilling.country,
      state: fromBilling.state,
      city: fromBilling.city,
      postalCode: fromBilling.postalCode,
    });
  }
  if (buyerUser) {
    candidates.push({
      country: buyerUser.country,
      state: buyerUser.state,
      city: buyerUser.city,
      postalCode: buyerUser.postalCode,
    });
  }

  // First candidate with at least a country is usable.
  for (const c of candidates) {
    if (c.country && String(c.country).trim().length > 0) return c;
  }
  return null;
}
