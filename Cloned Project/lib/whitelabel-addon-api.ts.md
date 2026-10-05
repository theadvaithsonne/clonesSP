# `lib/whitelabel-addon-api.ts`

> Typed frontend wrappers for the white-label add-on backend endpoints: price quote, entitlement status and invoice creation.

**Kind:** frontend library · **Lines:** 55

## Purpose
A white-label add-on lets an office run Garage on its own domain with its own branding. It is sold as a recurring yearly invoice. This module is the single place the founder-facing settings pages call to quote the price, check whether the office currently holds the add-on, and start a purchase. It is a thin layer over `api()` from `lib/api.ts`, which adds the bearer token and throws on non-2xx responses.

## How it works
Each function makes one request through `api()` (so the browser path is `API_URL` + path, i.e. `/backend/whitelabel-addon/...`):
- `fetchWhitelabelPrice()` - backend calls `quoteWhitelabelPrice(userId, orgId)` and returns the base USD price, whether GST applies, the GST amount, the total, the currency (`"USD"`), and the buyer's resolved country and how it was resolved (`regionSource`).
- `fetchWhitelabelStatus()` - backend calls `getWhitelabelStatus(orgId)`; returns `hasAccess`, optional `currentEnd` / `willRenewAt` ISO dates, `source`, and the last invoice (`id`, `number`, `paidAt`).
- `purchaseWhitelabelAddon()` - backend `purchaseWhitelabelAddon({ orgId, buyerUserId })` mints an invoice and returns `invoiceId`, `invoiceNumber`, `amountSmallest`, `currency` and `redirectUrl` (relative path of the invoice pay page). The caller (`WhitelabelPurchaseDialog`) opens `/invoice/<number or id>` in a new tab; payment happens there. On payment, invoice fulfilment activates the add-on and pays the buyer's direct referrer a commission. The backend rejects with 409 if the add-on is already active and 400 if the org has no resolvable founder.

## Exports
- `interface WhitelabelPriceResponse` - `{ success, baseUsdCents, gstApplicable, gstAmountSmallest, totalUsdCents, currency: "USD", country, regionSource }`.
- `interface WhitelabelStatusResponse` - `{ success, hasAccess, currentEnd?, willRenewAt?, source?, lastInvoice?: { id, number, paidAt? } }`.
- `interface WhitelabelPurchaseResponse` - `{ success, invoiceId, invoiceNumber, amountSmallest, currency, redirectUrl }`.
- `fetchWhitelabelPrice(): Promise<WhitelabelPriceResponse>`
- `fetchWhitelabelStatus(): Promise<WhitelabelStatusResponse>`
- `purchaseWhitelabelAddon(): Promise<WhitelabelPurchaseResponse>`

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/whitelabel-addon/price` - `requireAuth`; price quote for the caller's org.
  - `GET /backend/whitelabel-addon/status` - `requireAuth`; add-on entitlement for the caller's org.
  - `POST /backend/whitelabel-addon/purchase` - `requireAuth` + `requireFounder`; creates the add-on invoice.
  (Router: `server/routes/whitelabelAddon.ts`, mounted at `/whitelabel-addon` in `server/app.ts`.)

## Dependencies
- **Internal:** `lib/api.ts` - `api()` authenticated fetch helper.

## Used by
`components/dashboard/DomainManagementPage.tsx`, `components/dashboard/ManagementPage.tsx`, `components/dashboard/WhitelabelGate.tsx`, `components/dashboard/WhitelabelPage.tsx`, `components/dashboard/WhitelabelPurchaseDialog.tsx`.

## Notes
- The file's header comment is out of date: it says purchase "on-session charges the founder's saved card" with fixed $600/$300 figures. The current backend (`server/services/whitelabelAddonPurchase.ts`) only mints an invoice and hands off to the hosted `/invoice/...` pay page, where the founder picks any payment method. Amounts come from `server/config/whitelabelAddon.ts`, not this file.
