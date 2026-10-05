# `server/models/domainPurchaseRequest.model.ts`

> Mongoose model for a founder's request to buy a domain through Garage's name.com reseller account. Each request is recorded for manual handling, not registered automatically.

**Kind:** Mongoose model · **Lines:** 87

## Purpose
Founders can search for and request a custom domain (for their app or shop) during setup. Payment, refund-on-failure and renewal billing have not been decided yet, so no route spends money automatically. A request is stored here and an operator registers the domain deliberately. The registrant contact details are collected up front because name.com requires them at registration. Garage is the registrant of record, and the contact identifies the founder the domain is held for.

## How it works
Fields (`IDomainPurchaseRequest`):
- `orgId` (ObjectId, required, indexed) and `requestedBy` (user id stored as a string).
- `domain` (required, lowercased, trimmed).
- `priceUsd` / `renewalUsd`: the quote shown to the founder, margin already included. Default 0.
- `kind`: `"app" | "shop"` (default `"app"`), the app the domain will serve.
- `contact`: first/last name, email, phone, address1/address2, city, state, zip, and `country`, a 2-letter ISO-3166 code that is stored uppercased. Everything except `address2` is required.
- `status`: `"pending" | "registered" | "rejected" | "failed"` (default `"pending"`, indexed). Optional `note`.
- Timestamps are on.

There is a partial unique index on `{ domain, status }` limited to `status: "pending"`. A domain can have at most one open request, so a double submit cannot queue two registrations. Closed requests do not count against it.

## Exports
- `IDomainPurchaseRequest` - document interface.
- `DomainPurchaseRequest` - the model (default collection `domainpurchaserequests`), registered behind a `mongoose.models` guard.

## Interfaces
- **Database:** `DomainPurchaseRequest` - created by the request route. No code in this repo moves a request out of `pending`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/initialSetup.ts` (mounted at `/initial-setup`): `POST /backend/initial-setup/domain-request`. The route is founder-only. It validates the body with zod, re-prices the domain and confirms availability through name.com when that integration is configured, returns 409 if a pending request already exists, and then creates the row.

## Notes
- The contact block holds personal data (address, phone, email). Treat the collection as PII.
- Status transitions to `registered`, `rejected` or `failed` are expected to happen manually, for example directly in the database.
