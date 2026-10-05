# `server/models/installIntent.model.ts`

> Mongoose model for deferred deep-link handoff: a short-lived record of where a web visitor was heading just before installing a mobile app, so the app can redeem it on first launch.

**Kind:** Mongoose model · **Lines:** 95

## Purpose
Android passes a `referrer` payload through the Play Store install (Install Referrer API), so no server state is needed there. iOS has no equivalent, so this backend reconstructs the link the way attribution SDKs do: the web writes an intent keyed on a coarse device fingerprint, and the app's first launch claims the newest unclaimed matching intent. This preserves affiliate attribution and deep links (such as office invites) across an App Store install.

## How it works
Fields:
- `link` (required, max 2000) - in-app path to open after install, for example `/hq/garage-app?ref=aff_x`.
- `affiliateId` - extracted from the link for reporting.
- `app` - `"store" | "hq" | "nc" | "pay"` (default `"store"`): Garage Shop, Garage HQ, NetworkChains (a third-party client sharing this backend's auth) and GarageIRL. Scoping by app stops, for example, an HQ invite being redeemed by a Shop install on the same network. Rows from before this field are Shop's.
- `platform` - `"ios" | "android"` (required).
- Fingerprint parts: `ipHash` (required, hashed IP), `userAgent`, `osVersion`, `screen` (`"<w>x<h>"`), `timezone`, `locale`.
- `claimedAt` and `claimerKey` - when claimed, and a hash of the claiming app's fingerprint; a re-claim is only answered for the same key, so a device gets back the row it redeemed, never another phone's.
- Timestamps on.

The fingerprint is deliberately weak and not reversible; it only needs to pick one row out of a few created on the same network within the hour. Per the header, `claimIntent` in `server/services/installIntent.ts` refuses to guess when two candidates tie on score.

Indexes:
- `install_intent_claim_lookup_v2`: `{ ipHash, platform, app, claimedAt, createdAt: -1 }` - unclaimed intents for one network, platform and app, newest first.
- `install_intent_ttl_3h`: TTL on `createdAt`, 3 hours. Intents are only matchable for `MATCH_WINDOW_MS` (1 hour, defined in the service); the extra time helps debugging.

## Exports
- `InstallIntent` - model `"InstallIntent"` (default collection `installintents`).
- `IInstallIntent` - document interface.

## Interfaces
- **Database:** collection `installintents` (read/write; MongoDB TTL deletes rows after 3 hours).
- **Endpoints (in `server/routes/public.ts`, not this file):** `POST /backend/public/install-intent` (record) and `POST /backend/public/install-intent/claim` (claim).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/installIntent.ts` (`recordIntent`, `claimIntent`), `server/routes/public.ts` (mounted at `/public`), and the test `server/services/__tests__/installIntent.test.ts`.

## Notes
- The service's `RECLAIM_WINDOW_MS` is also 3 hours, matching the TTL; after that a re-claim can no longer find the row.
- Privacy: the raw IP is never stored, only `ipHash`.
