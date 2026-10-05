import { Types } from "mongoose";

/**
 * Storefront resolvability for affiliate-facing catalogs.
 *
 * garage.app resolves product pages from TWO different backends:
 *   · /product/:id          → store backend, resolves the `storeproducts`
 *                             collection (physical goods).
 *   · /digital/product/:id  → roam-backend GET /checkout/product/:id, resolves
 *                             the legacy `products` collection (DIGITAL goods).
 *
 * Physical products were migrated `products` → `storeproducts` (keeping `_id`),
 * so the legacy `products` collection is now the DIGITAL catalog. Any physical
 * doc still sitting in `products` is a migration orphan: it links to
 * /product/:id, but its id isn't in `storeproducts`, so garage.app 404s
 * ("Product not found"). Such orphans must never surface in any affiliate
 * catalog (Links, Cashback, EarnGPT).
 *
 * Rule: a legacy `products` doc is surfaceable ONLY if it is digital.
 */
export const LEGACY_DIGITAL_PRODUCT_FILTER: Record<string, unknown> = {
  $or: [{ isDigital: true }, { deliveryMethod: "digital" }],
};

/** In-memory equivalent of {@link LEGACY_DIGITAL_PRODUCT_FILTER} for fetched docs. */
export function isLegacyDigitalProduct(doc: any): boolean {
  return !!(doc?.isDigital || doc?.deliveryMethod === "digital");
}

/**
 * A `storeproducts` doc only renders on garage.app/product/:id if its org has an
 * ACTIVE store doc WITH a slug — otherwise the storefront 404s even for a
 * status:"active" product. Returns the subset of the given org ids that have
 * such a store (as string ids). Joins `stores` via the raw driver to stay
 * dependency-light (no Store model import), mirroring affiliate `/catalog`.
 */
export async function orgIdsWithActiveStore(
  orgIds: Array<Types.ObjectId | string>,
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = Array.from(new Set(orgIds.map((s) => String(s))))
    .filter((s) => Types.ObjectId.isValid(s))
    .map((s) => new Types.ObjectId(s));
  if (ids.length === 0) return out;
  const mongoose = (await import("mongoose")).default;
  const stores = await mongoose.connection
    .collection("stores")
    .find({ orgId: { $in: ids }, isActive: true })
    .project({ _id: 0, orgId: 1, slug: 1 })
    .toArray();
  for (const s of stores as any[]) {
    if (s.slug) out.add(String(s.orgId));
  }
  return out;
}
