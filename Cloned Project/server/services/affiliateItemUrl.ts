/**
 * Canonical affiliate destination for a catalog item.
 *
 * This is a server-side port of the NetworkChains web app's
 * `lib/affiliate/links-api.ts` → `buildAffiliateUrl`, which is the up-to-date
 * routing used by the Links page. Keep the two in step: a product kind added
 * there needs a case here.
 *
 * WHY THIS EXISTS
 * The member-profile tabs used to serve `AffiliateLink.affiliateUrl` — a value
 * persisted at link-creation time by routes/affiliate.ts as
 *
 *     `${AFFILIATE_BASE_URL}/${orgSlug}/${itemId}?ref=${affiliateId}`
 *
 * That shape has no notion of item kind (it takes an itemType and ignores it),
 * and points at the Office app rather than the storefront. Every kind of item
 * therefore got the same wrong URL, and because the value is STORED it never
 * picked up the routing that landed later. Computing on read fixes the links
 * retroactively for rows already in the database.
 *
 * Deliberately NOT changing routes/affiliate.ts: that would alter what gets
 * written for every future link, which is a wider blast radius than the profile
 * page needs. The stored column stays; the profile page just stops reading it.
 */

/** Public storefront hosting item pages; each captures `?ref` for attribution. */
const STOREFRONT_URL = (
  process.env.GARAGE_STOREFRONT_URL || "https://www.garage.app"
).replace(/\/+$/, "");

/** Webinars enrol on the Office app, not the storefront PDP. */
const OFFICE_URL = (
  process.env.GARAGE_OFFICE_URL || "https://my.garage.app"
).replace(/\/+$/, "");

export interface AffiliateItemRef {
  /** Backend itemType: channel | course | workshop | product | ecommerce_item |
   *  service | call | office | store. */
  itemType?: string | null;
  /** Catalog item id — the office/store cases use `slug` instead. */
  itemId?: string | null;
  /** Org slug, for office and store destinations. */
  slug?: string | null;
  /** True when a `product` is physical: those live at /product/<id> rather than
   *  /digital/product/<id>. */
  physical?: boolean;
}

/** Path on the storefront, or null when the item has no public page. */
function storefrontPath(item: AffiliateItemRef): string | null {
  const id = item.itemId ? String(item.itemId) : "";
  switch (item.itemType) {
    case "channel":
      return id ? `/digital/channel/${id}` : null;
    case "course":
      return id ? `/digital/course/${id}` : null;
    case "service":
      return id ? `/digital/service/${id}` : null;
    case "call":
      return id ? `/digital/call/${id}` : null;
    case "product":
    case "ecommerce_item":
      // `ecommerce_item` is the store-catalog flavour of a product and shares
      // its pages. Physical goods sit at the top level, digital under /digital.
      return id ? (item.physical ? `/product/${id}` : `/digital/product/${id}`) : null;
    case "office":
      return item.slug ? `/hq/${item.slug}` : null;
    case "store":
      return item.slug ? `/store/${item.slug}` : null;
    default:
      return null;
  }
}

/**
 * Build the member's affiliate link for one item, or null when the item has no
 * shareable destination (or the member has no affiliate id yet).
 */
export function buildAffiliateItemUrl(
  item: AffiliateItemRef,
  affiliateId: string | null | undefined,
): string | null {
  if (!affiliateId) return null;

  // Webinars are the one kind that leaves the storefront.
  if (item.itemType === "workshop") {
    const id = item.itemId ? String(item.itemId) : "";
    return id ? `${OFFICE_URL}/webinar/${id}?ref=${affiliateId}` : null;
  }

  const path = storefrontPath(item);
  return path ? `${STOREFRONT_URL}${path}?ref=${affiliateId}` : null;
}
