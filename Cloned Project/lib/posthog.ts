// ============================================================
// PostHog browser SDK — analytics, session replay, error tracking
// ============================================================
//
// Shares ONE PostHog project (554016) with all garage apps + NetworkChains;
// each surface tags its events with an `app` super property so they stay
// separable. This repo serves TWO surfaces from one bundle — my.garage.app
// (`garage-web`) and admin.garage.app (`garage-admin-web`) — so the tag is
// computed per page load rather than hardcoded; see currentSurface(). Session
// replays land in the shared admin panel, filterable by that property.
//
// The API host is a first-party garage domain (test.garage.app/ingest — roam's
// reverse proxy) rather than posthog.com, so browser ad-blockers and on-device
// DNS/VPN blockers can't URL-match *.posthog.com and drop events. Cross-origin
// is fine: roam's cors() allows it (same pattern as NetworkChains web).
import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Default to the roam /ingest proxy; overridable via env for local dev.
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://test.garage.app/ingest";

/**
 * Which surface this page load is, for the `app` super property.
 *
 * One repo, one bundle, two products: my.garage.app is the member app and
 * admin.garage.app is the admin console. Tagging both `garage-web` merged the
 * two in the Replays panel, so filtering to "Garage" showed staff sessions
 * mixed in with members'.
 *
 * Host is the real signal in production; the pathname check covers local dev
 * and previews, where the console is reached at /garage-admin on whatever host
 * the branch is served from.
 */
export type GarageSurface = "garage-web" | "garage-admin-web";

export function currentSurface(): GarageSurface {
  if (typeof window === "undefined") return "garage-web";
  const { hostname, pathname } = window.location;
  return hostname === "admin.garage.app" || pathname.startsWith("/garage-admin")
    ? "garage-admin-web"
    : "garage-web";
}

/**
 * Re-stamps the `app` super property for the current surface.
 *
 * Called on every navigation, not just at init: super properties persist per
 * origin, so a single visit to /garage-admin would otherwise tag every later
 * event on that browser as admin, long after the operator went back to the
 * member app.
 */
export function registerSurface(): void {
  if (!initialized) return;
  try {
    posthog.register({ app: currentSurface() });
  } catch {
    // Never let analytics break a navigation.
  }
}

let initialized = false;

export function initPostHog(): void {
  if (typeof window === "undefined") return;
  if (initialized) return;
  if (!POSTHOG_KEY) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[posthog] NEXT_PUBLIC_POSTHOG_KEY missing — analytics disabled",
      );
    }
    return;
  }
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    // ui_host points replay/toolbar links at the real PostHog UI (the proxy
    // host would 404 those).
    ui_host: "https://us.posthog.com",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true,
    capture_exceptions: true,
    session_recording: {
      // Masking off for parity with the other garage/NC surfaces; ratchet up
      // if a flow exposes sensitive DOM.
      maskAllInputs: false,
      maskTextSelector: undefined,
    },
    persistence: "localStorage+cookie",
    loaded: (ph) => {
      ph.register({ app: currentSurface() });
    },
  });
  initialized = true;
  console.info("[posthog] initialized via", POSTHOG_HOST);
}

/** Current distinct_id (anonymous or identified). */
export function getDistinctId(): string | null {
  if (!initialized) return null;
  try {
    return posthog.get_distinct_id();
  } catch {
    return null;
  }
}

/** Identify a user — merges prior anonymous events into this user_id. */
export function identifyUser(user: {
  id: string;
  email?: string;
  displayName?: string;
}): void {
  if (!initialized) return;
  posthog.identify(user.id, {
    email: user.email,
    name: user.displayName,
  });
}

/** Associate the current user with an organization (PostHog groups). */
export function setOrgGroup(org: { id: string; name?: string }): void {
  if (!initialized) return;
  posthog.group("organization", org.id, { name: org.name });
}

/** Reset on logout — fresh anonymous distinct_id for the next visitor. */
export function resetPostHog(): void {
  if (!initialized) return;
  posthog.reset();
}

export default posthog;
