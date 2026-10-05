// Bridge between the Garage Store backend (`storeproducts` collection)
// and the webinar pin picker's `Sellable` shape. The roam-backend's
// /api/invoices/sellables endpoint doesn't include storeproducts yet,
// so the Physical chip would otherwise stay empty — we fetch them
// here and merge client-side.
//
// Strategy:
//   1. GET /api/public/stores → list every storefront the customer-app
//      knows about. The Store doc *may* carry `orgId`; we use it when
//      present so we only fetch the founder's own stores' products.
//   2. If no store doc exposes the host's `orgId` (the public list
//      sometimes omits it), we fall back to fetching products from
//      *every* store in parallel and then filtering on the product's
//      own `orgId` — every `storeproducts` row carries `orgId`, so
//      this still honors the "founder's stores only" rule.
//   3. Map each product to the Sellable shape, copying `storeSlug`
//      and `storeName` so the picker's Store filter + attribution row
//      work.

import type { Sellable } from "@/lib/feed-api";

const CUSTOMER_APP_URL =
  process.env.NEXT_PUBLIC_CUSTOMER_APP_URL || "https://app.revenue.network";
const EXTERNAL_API_KEY = process.env.NEXT_PUBLIC_EXTERNAL_API_KEY || "";

type AnyRecord = Record<string, unknown>;

interface StoreDoc extends AnyRecord {
  _id: string;
  name?: string;
  slug?: string;
  orgId?: string | { toString(): string };
}

async function customerAppGet<T>(path: string): Promise<T> {
  const res = await fetch(`${CUSTOMER_APP_URL}${path}`, {
    method: "GET",
    headers: {
      "x-api-key": EXTERNAL_API_KEY,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`store-sellables ${path} → ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

function pickImage(p: AnyRecord): string | undefined {
  if (typeof p.featuredImage === "string" && p.featuredImage) {
    return p.featuredImage;
  }
  if (Array.isArray(p.images) && p.images.length > 0) {
    const first = p.images[0] as unknown;
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      const url = (first as { url?: unknown }).url;
      if (typeof url === "string") return url;
    }
  }
  return undefined;
}

function isPhysical(p: AnyRecord): boolean {
  // Storeproducts model exposes `isPhysicalProduct`; the legacy
  // Product schema uses `isDigital`. Either signals "physical".
  if (p.isPhysicalProduct === true) return true;
  if (p.isDigital === false) return true;
  // `requiresShipping` is a strong tiebreaker when neither field is
  // present on the response — shipping ⇒ physical.
  if (p.requiresShipping === true) return true;
  return false;
}

function productOrgId(p: AnyRecord): string | null {
  const raw = p.orgId ?? p.organizationId ?? null;
  if (raw == null) return null;
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw && "toString" in raw) {
    return String(raw);
  }
  return String(raw);
}

/**
 * Is this storeproducts row actually for sale right now?
 *
 * The public store endpoint returns the founder's whole catalog — auction
 * lots, sold items and archived rows included. The Shop can only drive a
 * fixed-price checkout, so everything else is dropped here.
 */
function isForSale(p: AnyRecord): boolean {
  // Draft / archived rows never surface.
  if (typeof p.status === "string" && p.status !== "active") return false;

  // Pure auction lots are won by bidding, not bought. A hybrid lot that
  // still exposes a buy-now price stays.
  const supportsBuyNow =
    p.buyNowEnabled === true ||
    (typeof p.buyNowPrice === "number" && p.buyNowPrice > 0);
  if (p.saleType === "auction" && !supportsBuyNow) return false;

  // Already won and paid for.
  const auction = (p.auction ?? null) as AnyRecord | null;
  if (auction?.status === "sold") return false;
  if (auction?.settlementStatus === "settled") return false;
  if (p.isSold === true) return false;

  // Out of stock. `trackInventory` is opt-in — untracked items are
  // always available.
  if (p.trackInventory === true && typeof p.quantity === "number") {
    if (p.quantity <= 0) return false;
  }

  return true;
}

function toSellable(
  p: AnyRecord,
  store: StoreDoc,
  orgId: string,
): Sellable | null {
  const itemId = p._id != null ? String(p._id) : "";
  if (!itemId) return null;
  if (!isForSale(p)) return null;
  const name =
    (typeof p.title === "string" && p.title) ||
    (typeof p.name === "string" && p.name) ||
    "";
  if (!name) return null;
  return {
    itemType: "store-product",
    itemId,
    name,
    description: typeof p.description === "string" ? p.description : undefined,
    price: typeof p.price === "number" ? p.price : 0,
    currency:
      typeof p.currency === "string" && p.currency ? p.currency : "USD",
    image: pickImage(p),
    isSubscription: false,
    isPhysical: isPhysical(p),
    organizationId: orgId,
    sellerId: typeof p.vendor === "string" ? p.vendor : undefined,
    storeSlug: typeof store.slug === "string" ? store.slug : undefined,
    storeName: typeof store.name === "string" ? store.name : undefined,
  };
}

/**
 * Returns the host's storefront sellables (one per `storeproducts`
 * row), already shaped for the webinar pin picker. Empty when the
 * founder has no stores, or when the customer-app is unreachable —
 * the caller treats failures as "no storefront items," not a fatal
 * error, so the picker can still render the rest of the catalog.
 *
 * Logs scope decisions to the console so a missing `orgId` field on
 * the public store doc can be diagnosed quickly when no physical
 * items appear.
 */
export async function listOrgStoreProducts(
  orgId: string | null | undefined,
): Promise<Sellable[]> {
  if (!orgId) {
    console.warn("[store-sellables] no host orgId; skipping");
    return [];
  }
  const { stores } = await customerAppGet<{ stores: StoreDoc[] }>(
    "/api/public/stores",
  );
  const all = stores || [];
  console.log(`[store-sellables] /api/public/stores → ${all.length} stores`);

  // Happy path: store doc exposes orgId. Filter first so we only fan
  // out product fetches to the founder's stores.
  const orgScoped = all.filter((s) => String(s.orgId ?? "") === orgId);

  // Fallback: store doc didn't surface orgId (or none matched). Fetch
  // products from every store and filter by product.orgId — every
  // storeproducts row carries it, so the founder-only rule still
  // holds. Cap to avoid runaway fan-out on very large catalogs.
  const useFallback = orgScoped.length === 0;
  const targetStores = useFallback ? all.slice(0, 50) : orgScoped;
  console.log(
    `[store-sellables] strategy=${useFallback ? "fallback" : "store.orgId"} stores=${targetStores.length}`,
  );

  if (targetStores.length === 0) return [];

  const perStore = await Promise.all(
    targetStores.map(async (store) => {
      try {
        const { products } = await customerAppGet<{ products: AnyRecord[] }>(
          `/api/public/stores/${store._id}/products`,
        );
        return { store, products: products || [] };
      } catch (err) {
        // One bad store shouldn't poison the rest — surface what we can.
        console.warn(
          `[store-sellables] products fetch failed for store ${store._id}:`,
          err,
        );
        return { store, products: [] as AnyRecord[] };
      }
    }),
  );

  const sellables: Sellable[] = [];
  let scanned = 0;
  let kept = 0;
  for (const { store, products } of perStore) {
    for (const p of products) {
      scanned++;
      // In fallback mode we don't know if the store belongs to the
      // founder, so we authoritatively check the product's own orgId
      // before keeping it. In the happy path (`!useFallback`) the
      // store was already filtered to the founder, so this just
      // verifies; if the product is missing orgId we keep it (trust
      // the upstream store filter).
      const pOrg = productOrgId(p);
      if (useFallback) {
        if (pOrg !== orgId) continue;
      } else if (pOrg && pOrg !== orgId) {
        continue;
      }
      const s = toSellable(p, store, orgId);
      if (s) {
        sellables.push(s);
        kept++;
      }
    }
  }
  console.log(
    `[store-sellables] scanned=${scanned} kept=${kept} physical=${sellables.filter((x) => x.isPhysical).length}`,
  );
  return sellables;
}
