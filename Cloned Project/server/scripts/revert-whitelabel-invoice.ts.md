# `server/scripts/revert-whitelabel-invoice.ts`

> Full reversal of a wallet-paid whitelabel_addon invoice that broke mid-fulfillment (no activation, no commission fired).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 296

<!-- docgen:auto -->

## Purpose
Full reversal of a wallet-paid whitelabel_addon invoice that broke
mid-fulfillment (no activation, no commission fired).

Steps (all inside one mongoose session so they atomically commit or
atomically roll back):
  1. Refuse if invoice isn't `paid` + `whitelabel_addon` + paid via
     `store_wallet` (this script only handles that shape).
  2. Refuse if invoice.metadata.reversedAt is already set (idempotent).
  3. Refuse if any whitelabel_* commission tx exists for this invoice
     (partial commission → we'd need a bespoke unwind — not this script).
  4. Credit `totalAmount` back to the buyer's StoreWallet on the org
     they paid from.
  5. Debit `tax` from Shorupan's HQ StoreWallet (reverse the
     gst_collected credit).
  6. Set invoice.status = "refunded", refundedAt = now, and stamp
     metadata.reversedAt + reversalReason. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`; **writes:** `deleteOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
  - `server/services/commission.ts` — `PLATFORM_USER_EMAIL`, `PLATFORM_ORG_ID`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/revert-whitelabel-invoice.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Invoice` (updateOne); `WalletTransaction` (create); `OfficeAddonSubscription` (deleteOne).
