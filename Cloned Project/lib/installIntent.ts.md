# `lib/installIntent.ts`

> Web half of deferred deep linking: carries a referral or in-app link across an App Store / Play Store install via the Play `referrer` parameter and a backend-parked "install intent" keyed on a coarse device fingerprint.

**Kind:** frontend library · **Lines:** 136

## Purpose
When someone opens a link such as `my.garage.app/login?referCode=aff_x` on a phone without the Garage HQ app, they are sent to the store, and the store launches the app afterwards with no URL, so the inviting affiliate would get no credit. This module preserves that link. On Android the link rides inside the Play URL's `referrer` parameter (read by the Install Referrer API). iOS has no equivalent, so the link is parked on the backend against a device fingerprint and the app claims it on first launch. The same exchange is used by the GarageIRL (Garage Pay) handoff pages, tagged `"pay"` so HQ and Pay rows can never be redeemed by the other app.

## How it works
- **`refInstallLink(code)`** validates a referral code against `^[A-Za-z0-9_-]{1,64}$` and returns `/?ref=<code>`, one of the shapes the backend's `INSTALL_LINK_RE` accepts. Anything malformed returns `null`, so a hand-edited URL cannot park arbitrary text.
- **`playReferrer(link, opts)`** builds a URL-encoded query string `utm_source=...&utm_medium=...&link=...` (defaults `garage_hq_web` / `affiliate_link`) for use as the Play Store `referrer` value. The comment notes Play truncates past 1000 chars.
- **`fingerprint(os, app)`** (private) collects deliberately coarse fields: `app`, `platform`, `osVersion` parsed from the user agent (iOS `OS 17_5_1` or `Android 14` forms), `screen` as CSS-pixel `widthxheight` (to match React Native's `Dimensions`), IANA `timezone` (try/catch), and `navigator.language`. No canvas/font probing. The IP is not sent; the backend hashes the request IP itself.
- **`registerInstallIntent(os, link, app = "hq")`** POSTs `{ link, ...fingerprint }` to `${API_URL}/public/install-intent` with `keepalive: true` so the request survives the page navigating to the store. It swallows all errors and never throws; callers fire it without awaiting. It deliberately uses bare `fetch` instead of `api()` so no bearer token is attached to this public endpoint. It is registered on Android too, because older HQ builds lack the Install Referrer native module; on newer builds the extra row just expires unclaimed.
- Backend side (for context): `server/routes/public.ts` validates the body with zod, re-checks the link against `INSTALL_LINK_RE`, caps writes at 30 per hashed IP within the match window, extracts an affiliate id from `?ref=` or `/register/aff_...`, and always answers 202.

## Exports
- `type InstallOS = "ios" | "android"`.
- `type InstallIntentApp = "hq" | "pay"` - which app a parked link belongs to.
- `refInstallLink(code: string | null | undefined): string | null` - safe `/?ref=` link or `null`.
- `playReferrer(link: string, { source?, medium? }?): string` - Play Store `referrer` payload.
- `registerInstallIntent(os: InstallOS, link: string, app?: InstallIntentApp): Promise<void>` - best-effort park of the link on the backend.

## Interfaces
- **Backend endpoints called:** `POST /backend/public/install-intent` - unauthenticated; records an `InstallIntent` row (model in `server/models/installIntent.model.ts`) for the app to claim later via `POST /backend/public/install-intent/claim`.
- **External services:** Google Play Install Referrer (via the `referrer` string the caller embeds in the Play URL).

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL` (the `/backend` base); trailing slashes are stripped before appending the path.

## Used by
- `components/shared/OpenInAppGate.tsx` - builds the Play URL with `playReferrer(refInstallLink(referCode))` and calls `registerInstallIntent` before the store bounce.
- `components/garage-irl/IrlHandoff.tsx` - `registerInstallIntent("ios", link, "pay")` for GarageIRL handoffs.
- `lib/garageIrl.ts` - `playReferrer` for GarageIRL Play links.

## Notes
- The fingerprint fields must stay identical to the app-side implementation (the header names `garage-chat/lib/deferred-link.ts`, and a mirror in `garage-store/lib/installIntent.ts`, both outside this repo); if they drift, claims never match.
- The backend intentionally returns nothing rather than guessing when two devices match equally; attribution is best-effort by design.
- Links are untrusted on both ends (written by a browser, read by the app), hence validation here and again server-side.
