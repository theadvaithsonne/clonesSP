/**
 * Validation for a post-action `?redirect=` destination.
 *
 * Signup funnels that start off-site (the whitelabel marketing page's "Upgrade"
 * CTA, for one) carry their destination through login → org creation → plan
 * picker → invoice. Every hop forwards the value untouched; this is the check
 * applied where it is finally consumed, so a hostile value can only ever cost
 * one navigation to a same-origin path.
 */

/**
 * The path to send someone to, or "" when there is nothing safe to use.
 *
 * Only same-origin paths are honoured. `//evil.com` parses as a protocol-
 * relative URL, so rejecting a leading `//` matters as much as requiring the
 * leading `/` — without it, any page that forwards this param becomes an open
 * redirect.
 */
export function safeRedirectPath(value: string | null | undefined): string {
  const path = (value || "").trim();
  if (!path.startsWith("/") || path.startsWith("//")) return "";
  return path;
}

/**
 * A post-action destination that leaves the site entirely.
 *
 * The one caller today is the hosted invoice page: a native app that hands a
 * payer over to my.garage.app passes `?redirect=networkchain://billing/paid`
 * so the browser tab bounces straight back into the app once payment lands.
 * `safeRedirectPath` above deliberately rejects anything that isn't a
 * same-origin path, so absolute/custom-scheme destinations need this instead —
 * and must be handed to `window.location.href`, not the Next router.
 *
 * Only `scheme://…` is accepted (this covers http/https), which already rules
 * out `javascript:alert(1)`. `javascript://x%0aalert(1)` does satisfy that
 * shape though — `//` is a comment in JS — so script-bearing schemes are also
 * denied by name. The regex is lower-case only, so `JavaScript://` never
 * matches in the first place.
 */
const DENIED_REDIRECT_SCHEMES = new Set([
  "javascript",
  "data",
  "vbscript",
  "blob",
  "file",
]);

export function safeAbsoluteRedirectUrl(
  value: string | null | undefined
): string {
  const url = (value || "").trim();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//.exec(url)?.[1];
  if (!scheme || DENIED_REDIRECT_SCHEMES.has(scheme)) return "";
  return url;
}
