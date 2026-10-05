import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LOSTMONEY_CUSTOM_DOMAIN_HOSTS } from "@/lib/lostmoney-domains";
import { ADMIN_APP_DOMAIN } from "@/lib/admin-domain";

// Custom App Domains that map to one specific public page/subtree instead of
// the full org workspace (that's the generic whitelabel flow in
// lib/whitelabel.ts). Keyed by hostname -> the app route to serve requests
// under. Add an entry here for each such domain.
const PATH_DOMAIN_MAP: Record<string, string> = {
  ...Object.fromEntries(
    LOSTMONEY_CUSTOM_DOMAIN_HOSTS.map((host) => [
      host,
      "/games/bat246/lostmoney/index",
    ])
  ),
  // Garage's own back-office. It lives at app/garage-admin/* in the tree but
  // is served from its own subdomain, so staff never go through the customer
  // app to reach it.
  //
  // Both URL shapes resolve here: "/login" is prefixed by the rule below,
  // and "/garage-admin/login" passes straight through. That is deliberate —
  // the section has ~290 hardcoded "/garage-admin/..." links and router
  // pushes, and this way none of them had to change.
  [ADMIN_APP_DOMAIN]: "/garage-admin",
};

// Short, branded paths yourmoneyback.info's own nav links to (SiteHeader /
// SiteFooter render these instead of the internal path when they detect
// they're on this domain — see LostMoneyLayout). Checked before the
// generic prefix rule below since several segment names don't match the
// underlying route 1:1 (e.g. "/aboutus" -> ".../index/about", not
// ".../index/aboutus").
const LOSTMONEY_ROUTE_ALIASES: Record<string, string> = {
  "/home": "/games/bat246/lostmoney/index",
  "/aboutus": "/games/bat246/lostmoney/index/about",
  "/paidlist": "/games/bat246/lostmoney/index/paid",
  "/testimonials": "/games/bat246/lostmoney/index/testimonials",
  "/register": "/games/bat246/lostmoney/index/register",
};

/**
 * Hosts we already know are not event domains, and the ones we know are.
 *
 * Event domains are per-event rows in the database, so unlike PATH_DOMAIN_MAP
 * they can't be a constant — the middleware has to ask the API. That lookup is
 * cached per isolate so a busy event page doesn't make one round trip per
 * request; `null` is cached too, because the common case is an unmapped host
 * and re-asking about it on every request would be the expensive mistake.
 */
const eventDomainCache = new Map<string, { slug: string | null; at: number }>();
const EVENT_DOMAIN_TTL_MS = 5 * 60 * 1000;

/** App routes that keep their own path on an organizer's event domain. */
const EVENT_DOMAIN_PASSTHROUGH = ["/invoice/", "/_next/"];

async function resolveEventDomain(host: string): Promise<string | null> {
  const hit = eventDomainCache.get(host);
  if (hit && Date.now() - hit.at < EVENT_DOMAIN_TTL_MS) return hit.slug;

  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const res = await fetch(
      `${api.replace(/\/+$/, "")}/public/event-management/resolve-domain?host=${encodeURIComponent(host)}`,
      // Short timeout: a slow API must not hold up every request on the app.
      { signal: AbortSignal.timeout(2000) }
    );
    const data = res.ok ? await res.json() : null;
    const slug = (data?.slug as string) || null;
    eventDomainCache.set(host, { slug, at: Date.now() });
    return slug;
  } catch {
    // On failure cache the miss briefly rather than hammering a struggling API.
    eventDomainCache.set(host, { slug: null, at: Date.now() });
    return null;
  }
}

/**
 * bat246.com and its subdomains. Same rule as isBat246Domain() in
 * lib/bat246Office.ts, which is client-only and can't be imported here.
 */
const BAT246_HOST_RE = /(^|\.)bat246\.com$/i;

/**
 * Crawlers that fetch a shared link to build its preview card. Search
 * engines are deliberately not on the list — this only changes the card.
 */
const LINK_PREVIEW_BOT_RE =
  /WhatsApp|facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|LinkedInBot|Discordbot|SkypeUriPreview|Pinterest|redditbot|Viber|SnapchatExternal|Iframely|Embedly|vkShare/i;

export async function middleware(request: NextRequest) {
  // nextUrl.hostname isn't reliable here (in `next dev` it reports the
  // server's own bind host, not the incoming Host header) — read the Host
  // header directly instead.
  const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
  const target = PATH_DOMAIN_MAP[host];

  const pathname = request.nextUrl.pathname;

  // A bat246.com link being shared: answer the preview crawler with the
  // BAT 246 card instead of the root layout's Garage title (see the route).
  // Pages only — the card's own image and every other file pass through.
  if (
    BAT246_HOST_RE.test(host) &&
    LINK_PREVIEW_BOT_RE.test(request.headers.get("user-agent") || "") &&
    !/\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/api/link-preview/bat246";
    url.search = "";
    // Passed as a header: query params set on a rewrite target don't reach
    // the route handler.
    const headers = new Headers(request.headers);
    headers.set("x-link-preview-path", pathname + request.nextUrl.search);
    return NextResponse.rewrite(url, { request: { headers } });
  }

  if (!target) {
    // Not a statically mapped domain. It may still be an organizer's custom
    // event domain, which is looked up rather than hardcoded. Skip the lookup
    // for the app's own hosts and for static files.
    const appHosts = [
      "localhost",
      "127.0.0.1",
      (process.env.NEXT_PUBLIC_APP_HOST || "").toLowerCase(),
    ].filter(Boolean);
    if (
      appHosts.includes(host) ||
      host.endsWith(".vercel.app") ||
      /\.[a-zA-Z0-9]+$/.test(pathname)
    ) {
      return NextResponse.next();
    }

    const slug = await resolveEventDomain(host);
    if (!slug) return NextResponse.next();

    // Paths the app owns outright, served as-is even on an event domain.
    // Checkout opens `/invoice/<number>` to take payment; rewritten under the
    // slug it would resolve to `/events/<slug>/invoice/...` and 404, so a
    // buyer on an organizer's own domain could never pay.
    if (EVENT_DOMAIN_PASSTHROUGH.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }

    // The domain IS the event, so "/" is the event page and everything under
    // it (e.g. "/ticket/<token>") maps beneath the same slug.
    const url = request.nextUrl.clone();
    url.pathname = `/events/${slug}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Anything with a file extension is a static file served from /public, and
  // must not be prefixed — "/logo-icon.svg" would become
  // "/garage-admin/logo-icon.svg" and 404. The admin sidebar logo and the
  // AI-provider icons are exactly this, and the mapped marketing domains
  // have the same exposure.
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // The aliases below are yourmoneyback.info's own nav vocabulary, so they
  // only apply on those hosts. Left global they would hijack the same paths
  // on every other mapped domain — "/register" on the admin host has nothing
  // to do with a lostmoney signup page.
  const aliasTarget = LOSTMONEY_CUSTOM_DOMAIN_HOSTS.includes(host)
    ? LOSTMONEY_ROUTE_ALIASES[pathname]
    : undefined;

  if (aliasTarget) {
    const url = request.nextUrl.clone();
    url.pathname = aliasTarget;
    return NextResponse.rewrite(url);
  }

  if (!pathname.startsWith(target)) {
    const url = request.nextUrl.clone();
    url.pathname = `${target}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
