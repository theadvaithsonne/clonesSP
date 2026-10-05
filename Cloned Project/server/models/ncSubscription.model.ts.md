# `server/models/ncSubscription.model.ts`

> Read-only Mongoose mirror of NetworkChains' recurring platform subscriptions (`networkchain_subscriptions` collection), used by Garage to derive a user type flag.

**Kind:** Mongoose model · **Lines:** 61

## Purpose
NetworkChains (NC), a separate product with its own backend (`contacts-backend`), owns the `networkchain_subscriptions` collection. Both backends share the same MongoDB cluster, so Garage opens its own Mongoose model on that collection instead of calling an API. This is the same pattern as `NcWallet` on `wallets`. Garage only reads it, mainly to compute `User.typeFlags.networkChainsSub`. The header names `contacts-backend/src/models/subscription.model.ts` as the source of truth; the field set must be kept in sync with that file.

## How it works
- `NcSubscriptionPaymentSchema` (no `_id`): `paymentId`, `orderId`, `amountCents` (GST-inclusive; the $0 combo free first month is stored as 0), `paidAt`.
- `NcSubscriptionSchema`, bound with `collection: "networkchain_subscriptions"` and timestamps:
  - `userId` - ref `User`, required, **unique**, indexed (one subscription per user).
  - `orgId` - required.
  - `status` - `active` | `expired` (default) | `canceled`.
  - `priceCents` - default 4248.
  - `currentPeriodStart`, `currentPeriodEnd` - access is locked once now is past `currentPeriodEnd`.
  - `payments[]`.
- The model name `"NcSubscription"` is local to Garage; only the collection belongs to NC.

## Exports
- `NcSubscription` - the Mongoose model.
- `INcSubscription`, `INcSubscriptionPayment` - interfaces.

## Interfaces
- **Database:** collection `networkchain_subscriptions` (owned by NetworkChains) - read only by convention.
- **External services:** NetworkChains backend (shared Mongo cluster, not HTTP).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/downlineTypeFlags.ts` - `NcSubscription.find(...)` to derive `networkChainsSub` type flags.
- `server/routes/garageAdminNetworkChainSubs.ts` (mounted under `/garage-admin`) - admin view of NC subscriptions.
- `server/scripts/setup-test-account.ts` - one-off test script (connects to the production database) that reads a user's NC subscription.

## Notes
- **Do not use `priceCents` to detect real payers:** it defaults to 4248 even for combo-only users. Use `payments` (non-zero `amountCents`) or `status`/`currentPeriodEnd` instead.
- Nothing stops Garage code from writing through this model, but writes would modify another product's data. Treat it as read-only.
- If NC changes its schema, this mirror silently drifts; Mongoose will not report the mismatch.
