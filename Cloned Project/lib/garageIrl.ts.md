# `lib/garageIrl.ts`

> Link builders, app-store constants and a product-preview fetcher for handing phone users off from this domain into GarageIRL, the Garage Pay buyer app.

**Kind:** frontend library · **Lines:** 156

## Purpose
GarageIRL is a separate mobile app (repo `garage-pay-seller`), not Garage HQ. Three kinds of link on this domain belong to it. Their handoff pages (`app/s/[slug]`, `app/a/[code]`, `app/product/[id]`) send phones into GarageIRL so that the generic `OpenInAppGate` doesn't open HQ instead:

| Web path | Meaning | `ref` param |
|---|---|---|
| `/s/<slug>[?ref=<table>]` | a store's printed counter QR | a **table label**, not an affiliate code |
| `/a/<CODE>` | a counter bill's "attach to bill" QR | none |
| `/product/<id>[?ref=aff_x]` | a product share link | an **affiliate id** |

The in-app deep-link path is the web path unchanged. So the builders here do two jobs: they validate each piece, and they produce the exact link used to launch the app, carried in the Play Store referrer, or parked for iOS deferred deep-linking.

## How it works
**Validation.** Each piece is checked against a fixed regex:
- slug: `[A-Za-z0-9_-]`, 1-120 characters
- bill code: alphanumeric, 4-12 characters
- product id: `[A-Za-z0-9_-]`, 1-64 characters
- table label: alphanumerics plus space, `_`, `.` and `-`, 1-64 characters
- affiliate ref: `aff_` + 6-10 alphanumerics, case-insensitive

**Link builders** (return a root-relative path, or `null`):
- `irlStoreLink(slug, table?)` - `null` for a bad slug. A bad table label is dropped and the store link is still returned.
- `irlBillLink(code)` - `null` for a malformed code.
- `irlProductLink(id, ref?)` - `null` for a bad id. The `ref` is kept only if it looks like an affiliate id; anything else is dropped rather than credited to nobody.
- The query values are URI-encoded.

**Launch URLs:**
- `irlPlayUrl(link, kind)` - the Play listing with `&referrer=` set to `playReferrer(link, { source: "garage_irl_web", medium })`. The app reads it back through the Install Referrer API on first launch. `medium` depends on the link kind: `counter_qr`, `bill_qr` or `product_share`. With no link it returns the plain listing.
- `irlIntentUrl(link, kind)` - an Android `intent://` URL with scheme `garagepayseller`, package `com.garagepayseller.app`, and `S.browser_fallback_url` set to the Play URL. If the app isn't installed, Chrome falls back to Play by itself, so no timer is needed.
- `irlSchemeUrl(link)` - the iOS custom-scheme URL `garagepayseller://<path>`. The caller must use a timer and a visibility check to fall back to the App Store.

**Product preview (`fetchIrlProduct`).** Fetches the public marketplace record that the app's product screen also reads (`getProductDetail` in garage-pay-seller), from `${NEXT_PUBLIC_ECOMMERCE_API_URL or https://ecommerce.networkchains.com}/storefront/marketplace/products/<id>`. The request uses Next.js fetch caching (`revalidate: 300`, so about 5 minutes) and a 3-second timeout.
- It reads `data.title`. The image is the first entry in `images[].url`, or the first variant that has an `image`.
- Price is formatted with `Intl.NumberFormat("en-IN")` in the product's currency, then the store's currency, then INR. Prices with a fractional part get 2 decimal places, others get none. If the currency code is invalid it falls back to `"<CUR> <price>"`.
- It returns `null` for a malformed id, a non-OK response, a missing title or any error. The handoff page still works without a preview.

## Exports
- `IRL_IOS_STORE_URL` - App Store listing URL for GarageIRL.
- `IRL_ANDROID_STORE_URL` - Play Store listing URL.
- `IRL_APP_SCHEME = "garagepayseller"` - custom URL scheme.
- `IRL_ANDROID_PACKAGE = "com.garagepayseller.app"` - Android package id.
- `type IrlLinkKind = "store" | "bill" | "product"`.
- `irlStoreLink(slug, table?): string | null`
- `irlBillLink(code): string | null`
- `irlProductLink(id, ref?): string | null`
- `irlPlayUrl(link: string | null, kind: IrlLinkKind): string`
- `irlIntentUrl(link: string | null, kind: IrlLinkKind): string`
- `irlSchemeUrl(link: string | null): string`
- `interface IrlProductPreview` - `{ title, image: string | null, price: string | null, storeName: string | null }`. This is what the product handoff page shows and what its Open Graph tags (for WhatsApp and iMessage previews) are built from.
- `fetchIrlProduct(id: string): Promise<IrlProductPreview | null>`

## Interfaces
- **External services:** NetworkChains ecommerce API (`GET /storefront/marketplace/products/:id`), Apple App Store, Google Play (Install Referrer).
- **Environment variables:** `NEXT_PUBLIC_ECOMMERCE_API_URL` - ecommerce API base. A trailing slash is removed, and it defaults to `https://ecommerce.networkchains.com`.

## Dependencies
- **Internal:** `lib/installIntent.ts` - `playReferrer()` builds the `utm_source` / `utm_medium` / `link` referrer string. The same module runs the iOS install-intent exchange, which tags GarageIRL rows as app `"pay"`.
- **Packages:** none (uses the built-in `fetch`, `AbortSignal.timeout` and `Intl`).

## Used by
- `app/product/[id]/page.tsx` - calls `fetchIrlProduct` in `generateMetadata` (Open Graph) and in the page body. Route `/product/[id]`.
- `components/garage-irl/IrlHandoff.tsx` - the client handoff component used by `/s/[slug]`, `/a/[code]` and `/product/[id]`. It uses the builders and launch URLs.

## Notes
- `fetchIrlProduct` relies on the Next.js `next.revalidate` fetch option, so it is meant to run on the server.
- The `ref` parameter means different things on `/s` and `/product`. Never pass a table label where an affiliate id is expected; the regexes enforce this.
- Store URLs and package ids are hard-coded. Changing the app's bundle ids means updating this file.
