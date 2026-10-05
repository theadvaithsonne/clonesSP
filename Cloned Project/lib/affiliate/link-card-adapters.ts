// Adapters that turn a Links-page `LinkItem` into the shapes other surfaces
// need: the shared product/office card items, the funnel's stored link
// snapshot, and back into a LinkItem for affiliate-URL building.

import type { LinkItem } from "./links-api";
import type { ProductCardItem } from "@/components/shared/product-card";
import type { OfficeCardItem } from "@/components/shared/office-card";
import type { FunnelLink } from "@/lib/api/funnels";

export function currencySym(currency: string) {
  return currency === "USD" ? "$" : `${currency} `;
}

export function priceLabel(it: LinkItem): string {
  if (!it.price) return "Free";
  const amount = `${currencySym(it.currency)}${it.price.toFixed(2)}`;
  return it.hasVariants ? `from ${amount}` : amount;
}

/** Normalise a catalog LinkItem into the shared product card's shape. */
export function linkToProductCardItem(it: LinkItem): ProductCardItem {
  const hasComm = it.price > 0 && !!it.commissionPct && it.commissionPct > 0;
  return {
    id: it.id,
    name: it.name,
    image: it.image,
    badge: it.category === "digital" ? "Digital" : "Physical",
    sellerName: it.sellerName || it.orgSlug || null,
    priceLabel: priceLabel(it),
    commissionAmount: hasComm
      ? `${currencySym(it.currency)}${((it.price * (it.commissionPct as number)) / 100).toFixed(2)}`
      : null,
    commissionPct: hasComm ? (it.commissionPct as number) : null,
  };
}

/** Adapt a Links catalogue office item into the shared OfficeCard shape. */
export function linkToOfficeCardItem(it: LinkItem): OfficeCardItem {
  return {
    id: it.id,
    name: it.name,
    image: it.image,
    logo: it.logo,
    coverPhoto: it.coverPhoto,
    country: it.country,
    memberCount: it.memberCount,
    offerCount: it.offerCount,
    industry: it.industry,
  };
}

/** Snapshot a chosen LinkItem into the funnel's stored product link. */
export function linkItemToFunnelLink(it: LinkItem): FunnelLink {
  // General links are plain URLs (no price/commission). The destination is
  // rebuilt from the stable id at the funnel end, so only identity is stored.
  if (it.category === "general") {
    return {
      itemType: "general",
      itemId: it.id,
      category: "general",
      name: it.name,
      image: it.image,
      // Carry the pre-built destination so the funnel's buy CTA can open it
      // (general items aren't resolvable from itemType/itemId alone).
      href: it.href,
    };
  }
  return {
    itemType: it.backendItemType ?? "product",
    itemId: it.id,
    category: it.category,
    orgSlug: it.orgSlug,
    name: it.name,
    image: it.image,
    price: it.price,
    currency: it.currency,
    commissionPct: it.commissionPct,
  };
}

/** Rebuild a LinkItem-shaped object from a stored funnel link so
 *  `buildAffiliateUrl` can derive the public destination. */
export function funnelLinkToLinkItem(link: FunnelLink): LinkItem {
  return {
    id: link.itemId,
    name: link.name,
    price: link.price ?? 0,
    currency: link.currency ?? "USD",
    image: link.image,
    category: (link.category as LinkItem["category"]) ?? "physical",
    orgSlug: link.orgSlug,
    backendItemType: link.itemType as LinkItem["backendItemType"],
    commissionPct: link.commissionPct,
  };
}
