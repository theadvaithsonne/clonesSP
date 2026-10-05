# `server/scripts/migrate-currency-to-usd.ts`

> Migration script: Convert all wallets from INR to USD

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 225

<!-- docgen:auto -->

## Purpose
Migration script: Convert all wallets from INR to USD

This script:
1. Resets all store wallet balances to 0 and sets currency to "USD"
2. Resets all affiliate wallet balances to 0 and sets currency to "USD"
3. Marks existing INR wallet transactions with metadata.legacyINR = true
4. Marks existing INR commission distributions with metadata.legacyINR = true
5. Creates a migration audit record

IMPORTANT: Uses raw MongoDB driver to bypass Mongoose immutable constraints on currency fields.

Run: npx ts-node src/scripts/migrate-currency-to-usd.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `storewallets`, `affiliatewallets`, `wallettransactions`, `commissiondistributions`, `migrations`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-currency-to-usd.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
