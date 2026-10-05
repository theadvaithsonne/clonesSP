// Deferred deep linking — the web half, for Garage HQ.
//
// Someone taps my.garage.app/login?referCode=aff_x on a phone without the HQ
// app. They go to the store, and the link that sent them there is lost: the
// store launches the app with no URL at all, so the affiliate who invited
// them is gone and the signup that follows credits nobody. These helpers
// carry the referral across the install.
//
// Android needs nothing from the server — Play forwards an arbitrary
// `referrer` string through the install to the Install Referrer API, so the
// link travels inside the Play URL itself (`playReferrer`).
//
// iOS has no equivalent, so the link is parked on the backend against a
// coarse device fingerprint and the app claims it back on first launch
// (`registerInstallIntent`). The app half is garage-chat/lib/deferred-link.ts
// — it reproduces this exact fingerprint, so the fields here must not drift
// from that file or nothing will ever match. The matching rules (and the
// deliberate choice to return nothing rather than guess between two candidate
// devices) are in garagenew-backend services/installIntent.ts.
//
// This mirrors garage-store/lib/installIntent.ts, which runs the same
// exchange from the storefront. Both write rows tagged with the app they were
// parked for, so a Garage Shop install can never redeem an HQ referral.
//
// GarageIRL (the Garage Pay buyer app) uses the same exchange from its
// handoff pages on this domain (/s, /a, /product — lib/garageIrl.ts), tagged
// "pay", so its links and HQ's can never be claimed by the other app.

import { API_URL } from "@/lib/api";

export type InstallOS = "ios" | "android";

/** Which app a parked link is for — the app only ever claims its own rows. */
export type InstallIntentApp = "hq" | "pay";

/**
 * The in-app link to hand across the install.
 *
 * A referral link names an affiliate but no destination — nowhere in
 * particular to go, just someone to credit — so it degrades to the bare
 * `/?ref=` form. That is one of the shapes the backend's INSTALL_LINK_RE
 * allows; anything outside that grammar is dropped server-side, since the
 * link is written by a browser and read back by the app and is therefore
 * untrusted on both ends.
 *
 * Returns null for a code that isn't shaped like one the backend issues, so a
 * hand-edited URL can't park arbitrary text.
 */
export function refInstallLink(code: string | null | undefined): string | null {
  if (!code || !/^[A-Za-z0-9_-]{1,64}$/.test(code)) return null;
  return `/?ref=${encodeURIComponent(code)}`;
}

/**
 * The `referrer` payload for a Play Store URL. Play requires a single
 * URL-encoded value and truncates past 1000 chars; ours is a query string so
 * the app parses it with the same reader it uses for any other install
 * source, and reads the destination out of `link`.
 */
export function playReferrer(
  link: string,
  { source = "garage_hq_web", medium = "affiliate_link" } = {}
): string {
  return new URLSearchParams({
    utm_source: source,
    utm_medium: medium,
    link,
  }).toString();
}

/**
 * Fingerprint fields the backend scores a claim on. Deliberately coarse — no
 * canvas or font probing, nothing that survives a browser restart. The IP does
 * the heavy lifting (hashed server-side, never sent from here); these only
 * break ties between phones on the same network.
 */
function fingerprint(os: InstallOS, app: InstallIntentApp) {
  // Safari's UA carries "OS 17_5_1"; Android's carries "Android 14".
  const ua = navigator.userAgent || "";
  const osVersion =
    /(?:iPhone )?OS (\d+[._]\d+(?:[._]\d+)?)/.exec(ua)?.[1] ||
    /Android (\d+(?:\.\d+)*)/.exec(ua)?.[1] ||
    null;

  return {
    app,
    platform: os,
    osVersion,
    // Logical (CSS) pixels, matching what React Native's `Dimensions` reports,
    // so both sides describe the same phone with the same numbers.
    screen: `${window.screen.width}x${window.screen.height}`,
    timezone: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
      } catch {
        return null;
      }
    })(),
    locale: navigator.language || null,
  };
}

/**
 * Park `link` server-side so the app can claim it after a store install.
 * Resolves either way — a failure here costs attribution, never the store
 * navigation the caller is about to perform, so it must not throw. Callers
 * should not await it: the request goes out with `keepalive` so the browser
 * finishes it even though the navigation tears the page down.
 *
 * Sent with a bare `fetch` rather than `api()` on purpose: this is a public,
 * unauthenticated endpoint, and `api()` would attach whatever bearer token
 * happens to be in storage to a call that has no use for it.
 *
 * Registered on Android as well as iOS. Android normally doesn't need it —
 * the Play referrer is exact — but HQ builds in the field predate the Install
 * Referrer native module, and for those the fingerprint is the only way back.
 * The app tries the referrer first, so on a build that has the module the
 * extra row simply expires unclaimed.
 */
export async function registerInstallIntent(
  os: InstallOS,
  link: string,
  app: InstallIntentApp = "hq"
): Promise<void> {
  try {
    await fetch(`${API_URL.replace(/\/+$/, "")}/public/install-intent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ link, ...fingerprint(os, app) }),
      keepalive: true,
    });
  } catch {
    /* attribution is best-effort — never block the store bounce */
  }
}
