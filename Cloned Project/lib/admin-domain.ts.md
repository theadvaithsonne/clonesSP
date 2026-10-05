# `lib/admin-domain.ts`

> Dependency-free constants for Garage's admin back-office host and the customer-facing app origin, plus a helper that builds absolute invoice URLs.

**Kind:** frontend library · **Lines:** 28

## Purpose
The admin back office is served from its own subdomain (`admin.garage.app`), which `middleware.ts` rewrites to the `/garage-admin` route tree. Several places need that hostname, and admin pages that link to customer pages (such as public invoices) need the customer app's origin, because a relative link would resolve against the admin host where those pages are not served. The file has no imports on purpose, so the Edge-runtime `middleware.ts` can import it without pulling `lib/whitelabel.ts` -> `lib/api` -> `lib/auth` into the Edge bundle.

## How it works
- `ADMIN_APP_DOMAIN` is the hostname string the middleware maps to `/garage-admin` (see `middleware.ts`, where it is a key in the host-rewrite table) and that `lib/whitelabel.ts` re-exports.
- `GARAGE_APP_ORIGIN` is hardcoded to `https://my.garage.app`. It deliberately does not follow the current origin: invoices always live on the main app, whichever host the admin is browsing.
- `invoiceUrl()` URL-encodes an invoice number or id and joins it onto `${GARAGE_APP_ORIGIN}/invoice/`.

## Exports
- `ADMIN_APP_DOMAIN: "admin.garage.app"` - the back-office hostname.
- `GARAGE_APP_ORIGIN: "https://my.garage.app"` - public origin of the Garage HQ web app.
- `invoiceUrl(numberOrId: string): string` - absolute URL of an invoice's public page (`https://my.garage.app/invoice/<encoded id>`).

## Dependencies
- **Internal:** none (intentionally).
- **Packages:** none.

## Used by
- `middleware.ts` - host-based rewrite of the admin domain to `/garage-admin`.
- `lib/whitelabel.ts` - imports and re-exports `ADMIN_APP_DOMAIN`.
- `app/garage-admin/(admin-dashboard)/organizations/[id]/page.tsx`
- `app/garage-admin/(admin-dashboard)/platform-coupons/page.tsx`
- `app/garage-admin/(admin-dashboard)/unilevel-plus-licenses/page.tsx`
- `components/garage-admin/InvoiceDetailDrawer.tsx`

## Notes
- Do not add imports here; doing so risks bloating or breaking the Edge middleware bundle.
- Because the origin is static, invoice links from a local or staging admin still point at production `my.garage.app`.
