// GarageIRL — the Garage Pay buyer app (repo garage-pay-seller).
//
// Not Garage HQ. Three kinds of link on this domain belong to it rather than
// to HQ, and their pages (app/s, app/a, app/product) hand phones off to it
// instead of letting OpenInAppGate open the wrong app:
//
//   /s/<slug>[?ref=<table>]   a store's printed counter QR. `ref` here is a
//                             TABLE LABEL, not an affiliate code.
//   /a/<CODE>                 a counter bill's "attach to bill" QR.
//   /product/<id>[?ref=aff_x] a product share link; `ref` IS an affiliate id.
//
// The in-app path is the web path verbatim, so the builders below both
// validate the pieces and produce the link the app is launched on, the Play
// referrer carries and the iOS install intent parks.

import { playReferrer } from "@/lib/installIntent";

export const IRL_IOS_STORE_URL =
  "https://apps.apple.com/in/app/garageirl/id6799842262";
export const IRL_ANDROID_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.garagepayseller.app";
export const IRL_APP_SCHEME = "garagepayseller";
export const IRL_ANDROID_PACKAGE = "com.garagepayseller.app";

export type IrlLinkKind = "store" | "bill" | "product";

// utm_medium on the Play referrer, so installs can be told apart by source.
const PLAY_MEDIUM: Record<IrlLinkKind, string> = {
  store: "counter_qr",
  bill: "bill_qr",
  product: "product_share",
};

const SLUG_RE = /^[A-Za-z0-9_-]{1,120}$/;
const BILL_CODE_RE = /^[A-Za-z0-9]{4,12}$/;
const PRODUCT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const TABLE_RE = /^[A-Za-z0-9 _.-]{1,64}$/;
const AFFILIATE_RE = /^aff_[a-z0-9]{6,10}$/i;

/**
 * In-app link for a counter QR. A bad slug yields null (the page still offers
 * the stores, just with nowhere to land); a bad table label is dropped and the
 * store still opens.
 */
export function irlStoreLink(
  slug: string | null | undefined,
  table?: string | null
): string | null {
  if (!slug || !SLUG_RE.test(slug)) return null;
  const ref = table && TABLE_RE.test(table) ? table : null;
  return `/s/${slug}${ref ? `?ref=${encodeURIComponent(ref)}` : ""}`;
}

/** In-app link for a bill's attach QR, or null for a malformed code. */
export function irlBillLink(code: string | null | undefined): string | null {
  if (!code || !BILL_CODE_RE.test(code)) return null;
  return `/a/${code}`;
}

/**
 * In-app link for a product share. Only a ref shaped like an affiliate id
 * rides along — anything else is dropped rather than credited to nobody.
 */
export function irlProductLink(
  id: string | null | undefined,
  ref?: string | null
): string | null {
  if (!id || !PRODUCT_ID_RE.test(id)) return null;
  const aff = ref && AFFILIATE_RE.test(ref) ? ref : null;
  return `/product/${id}${aff ? `?ref=${encodeURIComponent(aff)}` : ""}`;
}

/**
 * Play listing, with the link in `referrer` so the app can read it back via
 * the Install Referrer API on first launch. Plain listing when there is no
 * link to carry.
 */
export function irlPlayUrl(link: string | null, kind: IrlLinkKind): string {
  if (!link) return IRL_ANDROID_STORE_URL;
  const referrer = playReferrer(link, {
    source: "garage_irl_web",
    medium: PLAY_MEDIUM[kind],
  });
  return `${IRL_ANDROID_STORE_URL}&referrer=${encodeURIComponent(referrer)}`;
}

/**
 * Android launch URL: opens GarageIRL on `link` if installed, otherwise Chrome
 * follows the fallback to Play itself — no timer needed on a real device.
 */
export function irlIntentUrl(link: string | null, kind: IrlLinkKind): string {
  const path = (link || "").replace(/^\/+/, "");
  const fallback = encodeURIComponent(irlPlayUrl(link, kind));
  return `intent://${path}#Intent;scheme=${IRL_APP_SCHEME};package=${IRL_ANDROID_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

/** iOS launch URL. Needs a timer + visibility check to fall back to the store. */
export function irlSchemeUrl(link: string | null): string {
  return `${IRL_APP_SCHEME}://${(link || "").replace(/^\/+/, "")}`;
}

// What the product handoff page shows while the app opens, and what link
// previews (WhatsApp, iMessage) render from its Open Graph tags.
export interface IrlProductPreview {
  title: string;
  image: string | null;
  /** Formatted, e.g. "₹100". Null when the item has no price. */
  price: string | null;
  storeName: string | null;
}

const ECOMMERCE_API = (
  process.env.NEXT_PUBLIC_ECOMMERCE_API_URL || "https://ecommerce.networkchains.com"
).replace(/\/+$/, "");

/**
 * The public marketplace record the app's product screen also reads
 * (garage-pay-seller getProductDetail). Server-side, cached for a few minutes.
 * Null for a malformed id or any failure — the page still hands off without it.
 */
export async function fetchIrlProduct(
  id: string
): Promise<IrlProductPreview | null> {
  if (!PRODUCT_ID_RE.test(id)) return null;
  try {
    const res = await fetch(
      `${ECOMMERCE_API}/storefront/marketplace/products/${encodeURIComponent(id)}`,
      { next: { revalidate: 300 }, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const p = (await res.json())?.data;
    if (!p?.title) return null;
    const currency = p.currency || p.store?.currency || "INR";
    let price: string | null = null;
    if (typeof p.price === "number") {
      try {
        price = new Intl.NumberFormat("en-IN", {
          style: "currency",
          currency,
          maximumFractionDigits: p.price % 1 ? 2 : 0,
        }).format(p.price);
      } catch {
        price = `${currency} ${p.price}`;
      }
    }
    return {
      title: String(p.title),
      image: p.images?.[0]?.url || p.variants?.find((v: { image?: string }) => v.image)?.image || null,
      price,
      storeName: p.store?.name || null,
    };
  } catch {
    return null;
  }
}
