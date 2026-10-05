import { NextResponse } from "next/server";

// Apple App Site Association (AASA) — served at https://my.garage.app/.well-known/apple-app-site-association
//
// This domain (my.garage.app) is the Garage HQ web app.
//
// The Garage HQ mobile app (com.garageapp.hq) natively handles exactly three
// path prefixes, so those — and ONLY those — are claimed for Universal Links:
//  • /webinar/*  — the public webinar room (own guest/OTP flow)
//  • /hq/*       — canonical content deep links (/hq/{orgSlug}/{post|article|
//                  video|playlist|course|cabinet}/{id}) routed through the
//                  app's /link concierge, plus the HQ join page
//  • /f/*        — cabinet share links. The app's app/f/[token].tsx mirrors
//                  this page exactly (public → AUTH_REQUIRED → auto-join →
//                  view-only render), so a claimed link loses nothing: an
//                  office-only file still gates, and a public one still opens
//                  for a signed-out visitor.
//
// Everything else stays UNCLAIMED on purpose: /guest/*, /workspace,
// /checkout/*, /invoice/*, /organization*, /magic-link/* must keep opening in
// the browser — the app itself opens several of those in web views, and an
// OS-level claim would loop them back into the app. The in-page banners
// (OpenInAppGate / OpenInAppBanner) still cover "switch to app" everywhere
// Universal Links don't apply.
//
// GarageIRL (the Garage Pay buyer app, com.garagepayseller.app — repo
// garage-pay-seller) claims the three link shapes that belong to it and not
// to HQ (lib/garageIrl.ts):
//  • /product/* — product share links (?ref=aff_… affiliate id)
//  • /s/*       — a store's printed counter QR (?ref= is a table label)
//  • /a/*       — a counter bill's "attach to bill" QR
// Its app routes mirror these paths 1:1, so the link lands on the same
// screen. Where a Universal Link doesn't fire (in-app browsers, app not
// installed) the pages at app/product, app/s, app/a hand off instead.
//
// NOTE: app.garage.store (the Garage Store consumer app) is registered to
// the separate domain garage.app / www.garage.app — NOT this domain.
// Do not add Store app entries here.

export const dynamic = "force-static";

export function GET() {
  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: "6D597F794K.com.garageapp.hq",
            paths: ["/webinar/*", "/hq/*", "/f/*"],
          },
          {
            appID: "6D597F794K.com.garagepayseller.app",
            paths: ["/product/*", "/s/*", "/a/*"],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
