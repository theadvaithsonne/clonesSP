# `server/scripts/reverse-bat246-coin-sales.ts`

> src/scripts/reverse-bat246-coin-sales.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 296

<!-- docgen:auto -->

## Purpose
src/scripts/reverse-bat246-coin-sales.ts

Reverse 11 BAT 246 board sales (16–24 Sep 2026) that were paid with B2
COINS but booked as $650 USD sales.

What went wrong: each invoice carries `metadata.paidWithB2Coins: true`, yet
fulfilment credited the full $650 principal to Alan's BAT 246 store wallet
and paid a platform fee (4% or 10%) to Shorupan. No currency ever entered
the system. The coin ledger has no matching debit either — there are zero
`bat246b2cointransactions` for any of these buyers — so only the USD leg was
ever written.

Verified before writing this: the money reached EXACTLY two wallets and
nowhere else.
  * every CommissionDistribution shows totalCommission = 0
  * no territory / franchise payouts (0 rows in that ledger for 16–25 Sep) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `wallettransactions`, `storewallets`, `users`, `commissiondistributions`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/reverse-bat246-coin-sales.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--confirm`.
