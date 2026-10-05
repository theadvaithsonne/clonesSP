# `server/models/reserveLicense.model.ts`

> Mongoose model for a "reserve" Unilevel Plus (UP) licence: an extra plan licence a buyer purchased in bulk and can later assign to another user.

**Kind:** Mongoose model · **Lines:** 98

## Purpose
In the Unilevel Plus affiliate programme a buyer can pay for more licences than they need for themselves (quantity > 1 on the invoice, or any quantity if they already hold UP). Each extra licence becomes a `ReserveLicense` that sits in the owner's stock as `available` until they assign it to someone who does not yet have UP. Each licence triggers its own commission distribution at purchase time, so the model also links to that distribution.

## How it works
- **Ownership and origin:** `userId` (ref `User`, the buyer/owner, indexed), `invoiceId` (ref `Invoice`, indexed), `invoiceNumber`, `planId` (ref `UnilevelPlusPlan`), `distributionId` (ref `UnilevelPlusDistribution`).
- `purchasePaymentId` - required and **unique**; `server/services/reserveLicense.ts` sets it to a synthetic id `reserve_<invoiceId>_<seq>`, one per licence, which keeps creation idempotent per invoice slot and is also used as the commission `paymentId`.
- **Lifecycle:** `status` - `available` (default) | `assigned` | `expired`, indexed. On assignment `assignedTo` (ref `User`), `assignedAt` and `purchaseId` (ref `UnilevelPlusPurchase`, the purchase created for the recipient) are filled in.
- **Money:** `amount` (>= 0, required), `currency` (default `"USD"`); plus free-form `metadata` and timestamps.
- **Indexes:** `{ userId, status }` (a user's available licences) and `{ assignedTo }` (licences assigned to a user), in addition to the field indexes and the unique `purchasePaymentId`.

## Exports
- `ReserveLicense` - model `"ReserveLicense"` (collection `reservelicenses`).
- `IReserveLicense` - document interface.

## Interfaces
- **Database:** `ReserveLicense` (collection `reservelicenses`) - schema only.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/services/reserveLicense.ts` - `createReserveLicenses()` (called from invoice fulfilment), `getReserveLicenses()`, `getReserveStats()`, and `assignReserveLicense()` which checks ownership/status, refuses self-assignment or a target who already has UP, then in a transaction creates the recipient's `UnilevelPlusPurchase` and marks the licence assigned.
- `server/routes/garageAdminOneTimeAffiliates.ts` and `server/controllers/garageAdmin.controller.ts` - aggregate available reserve licences for admin reports.

## Notes
- `distributionId` is required, but when commission is skipped (zero-pay coupon, zero price) or distribution fails, the service stores a freshly generated `ObjectId` that points at no real distribution document. Do not assume it always resolves.
