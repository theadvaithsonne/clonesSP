/**
 * Storefront → app deep links.
 *
 * garage.app and my.garage.app are separate origins with separate
 * localStorage, so a session minted on the storefront is invisible here. Any
 * CTA over there that needs a member — joining an office, opening a community,
 * enrolling in a course, buying a digital product — therefore hands the whole
 * flow to this app instead of finishing in-store and stranding the buyer at a
 * second login.
 *
 * The storefront builds these URLs in `lib/api/sellableItems.ts`
 * (`officeJoinLoginUrl`, `buildUniversalItemDeeplinkUrl`); `/login` and
 * `/verify` consume them.
 */

/** Intents that mean "join `orgId`, then go to `redirect`". */
export const DEEPLINK_INTENTS = ["join-office", "item-deeplink"] as const;

export type DeeplinkIntent = (typeof DEEPLINK_INTENTS)[number];

export function isDeeplinkIntent(
  intent: string | null | undefined
): intent is DeeplinkIntent {
  return (
    !!intent && (DEEPLINK_INTENTS as readonly string[]).includes(intent)
  );
}

/**
 * Query params a deep link carries from the storefront, in the order they're
 * forwarded. `email` is added by /login; the rest come off the incoming URL
 * and have to survive the /login → /verify hop or the destination is lost.
 */
export const DEEPLINK_PARAMS = [
  "intent",
  "orgId",
  "orgSlug",
  "itemType",
  "itemId",
  "isPaid",
  "referCode",
  "redirect",
] as const;

/**
 * Copy every deep-link param present on `from` onto `to`.
 * Absent params are skipped rather than written empty, so a plain login keeps
 * the short URL it had.
 */
export function forwardDeeplinkParams(
  from: URLSearchParams,
  to: URLSearchParams
): URLSearchParams {
  for (const key of DEEPLINK_PARAMS) {
    const value = from.get(key);
    if (value) to.set(key, value);
  }
  return to;
}

/**
 * Build the `/login` URL for an "join this office, then go here" deep link.
 *
 * This is the in-app twin of the storefront's `officeJoinLoginUrl`: guest pages
 * (shared post/article links) hand their Join CTA to `/login` with these params
 * rather than running their own embedded email → OTP → phone modal. `/login`
 * then either joins an already-signed-in visitor in the background or collects
 * an OTP first, and `redirect` is where they land once `public-join` succeeds.
 *
 * `flow=login` is set so the login form is the first thing an unauthenticated
 * visitor sees, instead of the marketing card they'd otherwise have to click
 * through.
 */
export function buildOfficeJoinLoginUrl(opts: {
  orgId: string;
  orgSlug: string;
  referCode?: string | null;
  redirect: string;
}): string {
  const params = new URLSearchParams();
  params.set("intent", "join-office");
  params.set("orgId", opts.orgId);
  params.set("orgSlug", opts.orgSlug);
  if (opts.referCode) params.set("referCode", opts.referCode);
  params.set("flow", "login");
  params.set("redirect", opts.redirect);
  return `/login?${params.toString()}`;
}

/**
 * Constrain a `redirect` param to somewhere inside this app.
 *
 * `redirect` is attacker-controllable — it arrives on the URL and is handed
 * to `router.push` the moment a login succeeds. Left open, a crafted
 * `/login?intent=join-office&orgId=…&redirect=https://evil.example` bounces a
 * genuinely-authenticated user straight off-site, which is a phishing
 * hand-off wearing a real Garage login as its front door.
 *
 * Relative paths pass through. Absolute URLs are accepted only when they're
 * this same origin (some callers build full URLs) and are reduced to a path.
 * Anything else falls back rather than navigating.
 */
export function safeRedirect(
  raw: string | null | undefined,
  fallback: string
): string {
  if (!raw) return fallback;
  // Protocol-relative ("//evil.example") is absolute to a browser.
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  if (typeof window === "undefined") return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/**
 * Tack `completeProfile=true` onto a destination when the join said the user
 * has no profile yet.
 *
 * It rides on the destination URL rather than replacing it: a first-time buyer
 * still lands on the community/course/product they came for, with the profile
 * prompt over the top (see the dashboard layout's `completeProfile` effect).
 * Sending them to a profile page instead would lose the item — which is the
 * one thing this whole flow exists to preserve.
 */
export function withCompleteProfile(
  destination: string,
  needsProfile: boolean
): string {
  if (!needsProfile) return destination;
  // Relative URLs, so parse against a throwaway base and hand back the path.
  try {
    const url = new URL(destination, "https://my.garage.app");
    url.searchParams.set("completeProfile", "true");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    const sep = destination.includes("?") ? "&" : "?";
    return `${destination}${sep}completeProfile=true`;
  }
}
