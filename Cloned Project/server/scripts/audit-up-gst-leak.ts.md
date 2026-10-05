# `server/scripts/audit-up-gst-leak.ts`

> Audit unilevel-plus commission distributions where GST was passed as the sale amount (bug fixed in services/invoice.ts:2457).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 194

<!-- docgen:auto -->

## Purpose
Audit unilevel-plus commission distributions where GST was passed as
the sale amount (bug fixed in services/invoice.ts:2457). For every
distribution whose `saleAmount` looks like `plan.productPrice × 1.18`,
print the recipient breakdown and per-recipient overage.

Read-only. Prints a report — no wallet mutation.

Run: npx ts-node src/scripts/audit-up-gst-leak.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `unilevelplusdistributions`, `unilevelplusplans`, `users`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`
  - `dns`

## Used by

Entry: run by hand: `npx tsx server/scripts/audit-up-gst-leak.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
