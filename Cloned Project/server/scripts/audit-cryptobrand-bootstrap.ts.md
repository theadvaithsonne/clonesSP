# `server/scripts/audit-cryptobrand-bootstrap.ts`

> Audit a cryptobrand-office bootstrap purchase — given ONE invoice ID (either the cryptosub or the office_plan invoice), find its sibling invoice minted by the same bootstrap event, check payment/fulfillment state, and enumerate every commi…

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 135

<!-- docgen:auto -->

## Purpose
Audit a cryptobrand-office bootstrap purchase — given ONE invoice ID
(either the cryptosub or the office_plan invoice), find its sibling
invoice minted by the same bootstrap event, check payment/fulfillment
state, and enumerate every commission-related wallet tx tied to both.

Usage:
  npx tsx src/scripts/audit-cryptobrand-bootstrap.ts <invoiceIdOrNumber>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`, `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/audit-cryptobrand-bootstrap.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
