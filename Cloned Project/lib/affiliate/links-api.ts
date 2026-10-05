// Links page (1Network → Links) data layer.
//
// Aggregates the affiliatable Garage catalog into one unified `LinkItem[]`
// across categories, and builds the public affiliate URL each item links to.
// Everything is served by Garage (roam-backend, test.garage.app) and reached
// with the NC token via `api()`. The destination funnel lives on my.garage.app.

import { api } from "./base";

export type LinkCategory =
  | "general"
  | "physical"
  | "digital"
  | "office"
  | "ecommerce"
  | "offline";

export type BackendItemType =
  | "channel"
  | "product"
  | "office"
  | "store"
  | "course"
  | "service"
  | "workshop"
  | "call";

export interface LinkItem {
  id: string;
  name: string;
  price: number;
  currency: string;
  image?: string;
  /** Office-only: small avatar/badge image (org logo). */
  logo?: string;
  /** Office-only: large card banner image (org cover photo). */
  coverPhoto?: string;
  category: LinkCategory;
  rating?: number;
  ratingCount?: number;
  /** subscription cadence, when the item is recurring (offices, channels) */
  period?: string;
  /** Pre-built destination for hardcoded "general" items (links arrive later). */
  href?: string;
  /** Selling org of a catalog item (links + persistence are per-item, cross-org). */
  orgId?: string;
  orgSlug?: string;
  /** Real backend itemType for persistence (catalog items span more than the
   *  display categories — e.g. a course shows under "Digital Items"). */
  backendItemType?: BackendItemType;
  /** Selling org's display name (shown as "by …" on the card). */
  sellerName?: string;
  /** Direct (level-1) affiliate commission %, 0 when the item has no plan. */
  commissionPct?: number;
  /** Original ("was") price — rendered struck-through when > price. */
  compareAtPrice?: number;
  /** True for variant products; the card shows "from $price" (cheapest variant). */
  hasVariants?: boolean;
  /** Office-only stats from /affiliate/offices (undefined for catalog items). */
  memberCount?: number;
  offerCount?: number;
  industry?: string;
  country?: string;
}

// "General" links are a FIXED set of platform apps (mirrors the Links page's
// General tab). Each app exposes a Web / iOS / Android destination. These are
// the same links surfaced elsewhere, so they live here as the one source of
// truth. Network Chains' Web is the signed-in user's invite/registration link
// (resolved per-user from their affiliate id), so it stays dynamic.
export type GeneralApp = {
  key: string;
  name: string;
  web: string;
  ios: string;
  android: string;
  /** When true, the Web link is the per-user register link, not `web`. */
  webIsRegister?: boolean;
};

export const GENERAL_APPS: GeneralApp[] = [
  {
    key: "garage-shop",
    name: "Garage Shop",
    web: "https://www.garage.app/",
    ios: "https://apps.apple.com/in/app/garage-shop/id6770841662",
    android: "https://play.google.com/store/apps/details?id=app.garage.store",
  },
  {
    key: "network-chains",
    name: "Network Chains",
    web: "https://networkchains.com",
    ios: "https://apps.apple.com/app/networkchains/id6758221987",
    android: "https://play.google.com/store/apps/details?id=com.networkchain.app",
    webIsRegister: true,
  },
  {
    key: "garage",
    name: "Garage",
    web: "https://my.garage.app",
    ios: "https://apps.apple.com/in/app/garage-hq/id6754905027",
    android: "https://play.google.com/store/apps/details?id=com.garageapp.hq",
  },
];

const GENERAL_PLATFORMS = ["web", "ios", "android"] as const;
type GeneralPlatform = (typeof GENERAL_PLATFORMS)[number];

const GENERAL_PLATFORM_LABEL: Record<GeneralPlatform, string> = {
  web: "Web",
  ios: "iOS",
  android: "Android",
};

/** Stable id for a general link item, e.g. "network-chains::web". */
export function generalLinkId(appKey: string, platform: string) {
  return `${appKey}::${platform}`;
}

/** Resolve a general link's destination from its stable id. Network Chains' Web
 *  becomes the per-user register link when an affiliate id is available. */
export function resolveGeneralHref(id: string, affiliateId: string | null): string {
  const [key, platform] = id.split("::");
  const app = GENERAL_APPS.find((a) => a.key === key);
  if (!app) return "";
  if (platform === "web") {
    if (app.webIsRegister && affiliateId)
      return `https://networkchains.com/register/${affiliateId}`;
    return app.web;
  }
  if (platform === "ios") return app.ios;
  if (platform === "android") return app.android;
  return "";
}

/** The general links as pickable LinkItems (one per app × platform). */
export function getGeneralLinkItems(affiliateId: string | null): LinkItem[] {
  const items: LinkItem[] = [];
  for (const app of GENERAL_APPS) {
    for (const p of GENERAL_PLATFORMS) {
      const id = generalLinkId(app.key, p);
      items.push({
        id,
        name: `${app.name} · ${GENERAL_PLATFORM_LABEL[p]}`,
        price: 0,
        currency: "USD",
        category: "general" as const,
        href: resolveGeneralHref(id, affiliateId),
      });
    }
  }
  return items;
}

/** The public Garage storefront that hosts the item pages (each page captures
 *  ?ref for affiliate attribution). */
const AFFILIATE_BASE_URL =
  process.env.NEXT_PUBLIC_GARAGE_AFFILIATE_BASE_URL || "https://www.garage.app";

/** Webinars (backend itemType "workshop") enrol on the Office app, not the
 *  store PDP: my.garage.app/webinar/<id> (matches the Garage web app's own
 *  invite link). Only webinars use this host — all other item types stay on the
 *  storefront (AFFILIATE_BASE_URL). */
const WEBINAR_BASE_URL =
  process.env.NEXT_PUBLIC_GARAGE_OFFICE_URL || "https://my.garage.app";

// Public garage.app path per item type. The destination is keyed off the REAL
// itemType (a digital product and a course are both "Digital Items" but live at
// different paths). Offices link to an HQ page by org slug, not an item id.
function affiliatePath(
  item: LinkItem,
  ctx: { orgSlug: string | null },
): string | null {
  switch (item.backendItemType) {
    case "channel":
      return `/digital/channel/${item.id}`;
    case "course":
      return `/digital/course/${item.id}`;
    case "workshop":
      // Overridden in buildAffiliateUrl → my.garage.app/webinar/<id> (webinars
      // enrol on the Office app). This storefront path is kept only as a
      // fallback and is not reached via buildAffiliateUrl.
      return `/digital/workshop/${item.id}`;
    case "service":
      return `/digital/service/${item.id}`;
    case "call":
      return `/digital/call/${item.id}`;
    case "product":
      return item.category === "physical"
        ? `/product/${item.id}`
        : `/digital/product/${item.id}`;
    case "office": {
      const slug = item.orgSlug || ctx.orgSlug;
      return slug ? `/hq/${slug}` : null;
    }
    case "store": {
      // Storefront home (e-commerce + offline stores). The store's own slug is
      // carried in `orgSlug` from /affiliate/offices.
      const slug = item.orgSlug || ctx.orgSlug;
      return slug ? `/store/${slug}` : null;
    }
    default:
      return null;
  }
}

export function buildAffiliateUrl(
  item: LinkItem,
  ctx: { orgSlug: string | null; affiliateId: string | null },
): string {
  // General links carry their own destination when built in-app; when rebuilt
  // from a stored funnel link (no href), resolve it from the stable id + the
  // affiliate id (so Network Chains' Web becomes the user's register link).
  if (item.category === "general")
    return item.href || resolveGeneralHref(item.id, ctx.affiliateId);
  if (!ctx.affiliateId) return "";
  // Webinars (itemType "workshop") point at the Office app's enrolment page —
  // my.garage.app/webinar/<id> — NOT the storefront workshop PDP. Everything
  // else keeps the storefront host untouched.
  if (item.backendItemType === "workshop") {
    return `${WEBINAR_BASE_URL}/webinar/${item.id}?ref=${ctx.affiliateId}`;
  }
  const path = affiliatePath(item, ctx);
  if (!path) return "";
  return `${AFFILIATE_BASE_URL}${path}?ref=${ctx.affiliateId}`;
}

export function buildEmbedHtml(item: LinkItem, url: string): string {
  if (!url) return "";
  return `<a href="${url}" target="_blank" rel="noopener noreferrer">${item.name}</a>`;
}

// ---- raw backend shapes (only the fields we use) ----
interface RawCatalogItem {
  itemType: BackendItemType;
  itemId: string;
  category: string; // backend may send "store"; filtered out below
  name: string;
  price: number;
  currency?: string;
  image?: string;
  orgId: string;
  orgSlug: string;
  period?: string;
  rating?: number;
  ratingCount?: number;
  sellerName?: string;
  commissionPct?: number;
  compareAtPrice?: number;
  hasVariants?: boolean;
}

/** The affiliate-eligible catalog (every active sellable — commission plan
 *  optional), across ALL orgs — fills Physical / Digital, including communities
 *  (channels, category "digital"). The `!== "store"` filter below is defensive:
 *  the backend never sends that category, so nothing real is dropped. */
export async function getAffiliateCatalog(): Promise<LinkItem[]> {
  const res = await api<{ items?: RawCatalogItem[] }>(`/affiliate/catalog`, {
    method: "GET",
  });
  return (res.items ?? [])
    .filter((it) => it.category !== "store")
    .map((it) => ({
      id: it.itemId,
      name: it.name,
      price: it.price ?? 0,
      currency: it.currency || "USD",
      image: it.image,
      category: it.category as LinkCategory,
      rating: it.rating,
      ratingCount: it.ratingCount,
      period: it.period,
      orgId: it.orgId,
      orgSlug: it.orgSlug,
      backendItemType: it.itemType,
      sellerName: it.sellerName,
      commissionPct: it.commissionPct ?? 0,
      compareAtPrice: it.compareAtPrice,
      hasVariants: it.hasVariants,
    }));
}

interface RawOffice {
  id: string;
  name: string;
  slug: string;
  /** Digital office, or a storefront split by storeKind. */
  kind?: "office" | "ecommerce" | "offline";
  image?: string;
  /** Small avatar/badge image. */
  logo?: string;
  /** Large card banner image. */
  coverPhoto?: string;
  memberCount?: number;
  offerCount?: number;
  industry?: string;
  country?: string;
}

/** All organizations (HQs) as offices — each links to /hq/{slug}?ref=. The
 *  office card reads the memberCount/offerCount/industry/country extras. */
export async function getOfficeItems(): Promise<LinkItem[]> {
  const res = await api<{ offices?: RawOffice[] }>(`/affiliate/offices`, {
    method: "GET",
  });
  return (res.offices ?? []).map((o) => {
    const kind = o.kind ?? "office";
    // A store's link goes to /store/{slug}; an office's to /hq/{slug}. `orgSlug`
    // carries the store slug for stores (the backend returns it per kind).
    const category: LinkCategory =
      kind === "ecommerce" ? "ecommerce" : kind === "offline" ? "offline" : "office";
    return {
      id: o.id,
      name: o.name,
      price: 0,
      currency: "USD",
      image: o.image,
      logo: o.logo,
      coverPhoto: o.coverPhoto,
      category,
      backendItemType: kind === "office" ? "office" : "store",
      orgId: o.id,
      orgSlug: o.slug,
      memberCount: o.memberCount,
      offerCount: o.offerCount,
      industry: o.industry,
      country: o.country,
    };
  });
}

export interface LinkStats {
  totalLinks: number;
  clicksToday: number;
  topConvertingProduct: {
    itemId: string | null;
    itemType: string | null;
    name: string;
    conversions: number;
  } | null;
}

/** Links-page stat cards: total links, clicks today, top converting product. */
export async function getLinkStats(orgId: string): Promise<LinkStats> {
  try {
    const res = await api<{ stats: LinkStats }>(
      `/affiliate/links/stats?orgId=${orgId}`,
      { method: "GET" },
    );
    return (
      res.stats ?? { totalLinks: 0, clicksToday: 0, topConvertingProduct: null }
    );
  } catch {
    return { totalLinks: 0, clicksToday: 0, topConvertingProduct: null };
  }
}

// Fallback display-category → itemType (used only when an item lacks the real
// backendItemType, e.g. office plans). "general" items aren't persisted.
const ITEM_TYPE_BY_CATEGORY: Record<LinkCategory, BackendItemType | null> = {
  general: null,
  physical: "product",
  digital: "product",
  office: "office",
  ecommerce: "store",
  offline: "store",
};

/** Persist an affiliate link for a catalog item (idempotent) so the
 *  Total Links Generated count is real. Uses the item's OWN selling org and
 *  real itemType. No-op for hardcoded General Garage items.
 *  `fallbackOrgId` covers items with no per-item org (e.g. office plans). */
export async function persistLink(
  fallbackOrgId: string,
  item: LinkItem,
): Promise<void> {
  const itemType = item.backendItemType ?? ITEM_TYPE_BY_CATEGORY[item.category];
  if (!itemType) return;
  const orgId = item.orgId ?? fallbackOrgId;
  if (!orgId) return;
  await api(`/affiliate/links`, {
    method: "POST",
    body: JSON.stringify({ orgId, itemType, itemId: item.id }),
  });
}
