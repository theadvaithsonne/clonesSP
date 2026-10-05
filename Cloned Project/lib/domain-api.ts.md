# `lib/domain-api.ts`

> Typed browser-side client for a domain-reseller API (search, Razorpay-paid purchase and renewal, DNS and registrar settings), plus small formatting helpers for the Domains page.

**Kind:** frontend library · **Lines:** 424

## Purpose
This module wraps every call the `/domains` dashboard page makes to a domain-reseller backend (the comments refer to Name.com as the upstream registrar). It defines the TypeScript shapes of domains, DNS records, contacts and pricing, and exposes one async function per backend operation. Every request goes through the shared `api()` helper from `lib/api.ts`, so it is sent to `NEXT_PUBLIC_API_URL` (now `<app origin>/backend`) with the user's bearer token.

**Important:** no Express router serving `/domains` is mounted in `server/app.ts`, and there is no `app/api/domains` route handler. In this project every function below that hits the network will currently fail (404 / "Server error"). The registrar integration that does exist on the server (`server/services/namecom.ts`, used by `server/routes/initialSetup.ts` with the `DomainPurchaseRequest` model) uses different endpoints and is not called by this file.

## How it works
The file is split into commented sections:

- **Types (L6-L106)** - `DomainAvailability`, `DomainSearchResult`, `DomainPricing` (retail vs wholesale prices), `DomainContact` (registrant/admin/tech/billing contact), `DnsRecord` (record `type` restricted to A, AAAA, ANAME, CNAME, MX, NS, SRV, TXT, CAA), `Domain` (a stored domain document with status, expiry, lock/auto-renew flags, nameservers, contacts, prices, Razorpay ids, `paymentStatus`, DNS records), `PurchaseDomainOptions` and `RazorpayOrder`.
- **Search & pricing (L108-L142)** - availability search over a list of names, keyword suggestions with optional TLD filter, single-domain pricing (domain is URL-encoded).
- **Purchase (L144-L178)** - a two-step Razorpay flow: `purchaseDomain` creates a pending domain record and returns a Razorpay order; after the Razorpay checkout succeeds the page calls `verifyDomainPayment` with the order id, payment id and signature so the server can verify and complete registration.
- **Management (L180-L203)** - list the user's domains, fetch one, and force a sync with the registrar.
- **DNS (L205-L253)** - list, create, update (type and id cannot be changed) and delete DNS records, addressed by numeric `recordId`.
- **Settings (L255-L303)** - nameservers, auto-renew, registrar lock, and fetching the transfer auth code.
- **Renewal (L305-L340)** - same Razorpay two-step pattern as purchase (`renewDomain` then `verifyRenewalPayment`, years default 1).
- **Utilities (L342-L423)** - pure helpers with no network access (see Exports).

Errors are not handled here: `api()` throws an `Error` whose message is the backend's `error`/`message` field (or `Server error (<status>)`), and callers catch it.

## Exports
Types: `DomainAvailability`, `DomainSearchResult`, `DomainPricing`, `DomainContact`, `DnsRecord`, `Domain`, `PurchaseDomainOptions`, `RazorpayOrder`.

Network functions (all `async`, return the parsed JSON):
- `searchDomains(domains: string[])` - availability for each name.
- `getDomainSuggestions(keyword, tlds?)` - suggested names.
- `getDomainPricing(domain)` - `{ success, pricing }`.
- `purchaseDomain(options: PurchaseDomainOptions)` - `{ success, domain, razorpayOrder }`.
- `verifyDomainPayment({ domainId, razorpayOrderId, razorpayPaymentId, razorpaySignature })` - `{ success, domain }`.
- `listDomains()` - `{ success, domains }`.
- `getDomain(domainId)` - `{ success, domain }`.
- `syncDomain(domainId)` - refresh from registrar.
- `getDnsRecords(domainId)`, `createDnsRecord(domainId, record)`, `updateDnsRecord(domainId, recordId, record)`, `deleteDnsRecord(domainId, recordId)`.
- `updateNameservers(domainId, nameservers)`, `setAutoRenew(domainId, enabled)`, `setDomainLock(domainId, locked)`, `getAuthCode(domainId)`.
- `renewDomain(domainId, years = 1)` - `{ success, renewal, razorpayOrder }`.
- `verifyRenewalPayment(domainId, { razorpayOrderId, razorpayPaymentId, razorpaySignature, years })`.

Pure helpers:
- `parseDomainName(domain)` - lower-cases and splits at the first dot into `{ name, tld }` (so `a.co.uk` gives tld `co.uk`); returns `tld: ""` if there is no dot.
- `formatDomainPrice(price, currency = "USD")` - `Intl.NumberFormat` en-US currency string.
- `getDaysUntilExpiry(expiresAt)` - whole days until the date, rounded up (negative once expired).
- `getDomainStatusColor(status)` - active green, pending yellow, expired/failed red, anything else gray.
- `POPULAR_TLDS` - 15 TLD strings with leading dots (`.com`, `.net`, `.org`, `.io`, `.ai`, ...).
- `generateDomainVariations(keyword, tlds = POPULAR_TLDS)` - strips everything except `a-z0-9-` from the keyword and appends each TLD.

## Interfaces
- **Backend endpoints called** (none of these exist in `server/app.ts` today):
  - `POST /backend/domains/search` - body `{ domains }`
  - `POST /backend/domains/suggestions` - body `{ keyword, tlds }`
  - `GET /backend/domains/pricing/:domain`
  - `POST /backend/domains/purchase` - body `PurchaseDomainOptions`
  - `POST /backend/domains/verify-payment`
  - `GET /backend/domains` and `GET /backend/domains/:domainId`
  - `POST /backend/domains/:domainId/sync`
  - `GET|POST /backend/domains/:domainId/dns`, `PUT|DELETE /backend/domains/:domainId/dns/:recordId`
  - `POST /backend/domains/:domainId/nameservers`, `/autorenew`, `/lock`
  - `GET /backend/domains/:domainId/authcode`
  - `POST /backend/domains/:domainId/renew`, `/verify-renewal`
- **External services:** Razorpay (the order/payment/signature fields come from the Razorpay checkout run by the page); Name.com is the registrar implied by the comments.

## Dependencies
- **Internal:** `lib/api.ts` - `api()` fetch wrapper (base URL, bearer token, JSON headers, error extraction).
- **Packages:** none.

## Used by
- `app/(dashboard)/domains/page.tsx` (Next.js route `/domains`) - imports the search, purchase, list and DNS functions and the helpers.

## Notes
- Because the backend routes are missing in this merged project, the Domains page is effectively non-functional until a `/domains` router is added to `server/app.ts`.
- Payment verification relies entirely on the server checking the Razorpay signature; the client merely forwards it.
- `getAuthCode` returns a registrar transfer secret - treat responses as sensitive and avoid logging them.
