import { redirect } from "next/navigation";

/**
 * Web fallback for the canonical deep-link URLs the mobile app claims via
 * universal links: my.garage.app/hq/{orgSlug}/{type}/{id}.
 *
 * On a device with the Garage HQ app installed, iOS/Android intercept these
 * URLs before any web request happens (AASA / assetlinks in public/.well-known
 * plus the app's intent filters). This page is what everyone ELSE gets — it
 * forwards to the existing /guest/{slug}/... experience so a shared link is
 * never a dead end, preserving the query string (referCode etc.).
 *
 * Keep the type map in lockstep with the app's parser (garage-chat
 * lib/link-intent.ts) and the backend share-link builders.
 */

// Content types with a dedicated guest page. Anything else (e.g. cabinet,
// which has no guest equivalent) falls back to the org's guest home.
const GUEST_PAGE_TYPES = new Set([
  "post",
  "article",
  "video",
  "playlist",
  "course",
  "channel",
  "recording",
  "product",
]);

interface Props {
  params: Promise<{ slug: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function HQDeepLinkFallback({ params, searchParams }: Props) {
  const { slug, rest = [] } = await params;
  const sp = await searchParams;

  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value.length) qs.set(key, value[0]);
  }
  const query = qs.toString() ? `?${qs.toString()}` : "";

  const [type, id] = rest;
  // Compound workshop-recording links (/hq/{slug}/video/{workshopId}?rec=…)
  // have a richer web page than the generic video route: the dedicated
  // recording player. The app plays the exact recording from the same URL.
  if (type === "video" && typeof sp.rec === "string" && sp.rec) {
    qs.delete("rec");
    const recQuery = qs.toString() ? `?${qs.toString()}` : "";
    redirect(`/guest/${slug}/recording/${sp.rec}${recQuery}`);
  }
  if (type && id && GUEST_PAGE_TYPES.has(type)) {
    redirect(`/guest/${slug}/${type}/${id}${query}`);
  }
  redirect(`/guest/${slug}${query}`);
}
