# `server/scripts/find-coupon-ecommerce-overcredits.ts`

> Enumerate every ecommerce invoice paid with a coupon before the per-line coupon-discount fix landed.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 250

<!-- docgen:auto -->

## Purpose
Enumerate every ecommerce invoice paid with a coupon before the
per-line coupon-discount fix landed. Reports the over-credit to
each recipient (seller, affiliates, platform, territory owners).

Bug: services/invoice.ts ecommerce_item branch computed commissions
on li.totalPrice (PRE-discount) instead of on (li.totalPrice - lineDiscount).
Every downstream credit — seller gross, platform fee, comb-plan
affiliates, System A territory slices, System B franchise slices —
inflated by the same fraction (discount / preDiscountLineTotal).

Report shape:
  - Per-invoice detail: buyer, item, coupon, discount amount,
    recipients with (credited, should-be, over-credit).
  - Aggregated: per-recipient total over-credit in USD.

Dry-run only — writes nothing. Reconciliation is a separate script. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `find`
  - `TerritoryWalletTransaction` (server/models/territoryWalletTransaction.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`
- **Raw collections:** `invoices`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/territoryWalletTransaction.model.ts` — `TerritoryWalletTransaction`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/find-coupon-ecommerce-overcredits.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
