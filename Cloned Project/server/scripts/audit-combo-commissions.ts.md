# `server/scripts/audit-combo-commissions.ts`

> Read-only audit: walk every combo_free_first_month invoice and report on whether commissions distributed as expected.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 129

<!-- docgen:auto -->

## Purpose
Read-only audit: walk every combo_free_first_month invoice and report on
whether commissions distributed as expected.

Expected per combo activation:
  UP invoice ($25, status: paid)        → distributeUnilevelPlusCommission ran
  Combo invoice ($0, status: paid)      → NO distribution (zero-pay branch)
  Children at full price (cycle 2+)     → distributeThirdPartySubscription ran per cycle

Run: `npx ts-node src/scripts/_audit-combo-commissions.ts`

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `invoices`, `commissiondistributions`, `unilevelplusdistributions`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/audit-combo-commissions.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
