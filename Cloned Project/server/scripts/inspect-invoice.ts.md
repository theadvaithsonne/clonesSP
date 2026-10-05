# `server/scripts/inspect-invoice.ts`

> Dump the full invoice + related state so we can see exactly why fulfillInvoice didn't do what we expected.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 81

<!-- docgen:auto -->

## Purpose
Dump the full invoice + related state so we can see exactly why
fulfillInvoice didn't do what we expected.

Usage: npx tsx src/scripts/inspect-invoice.ts <invoiceId>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/inspect-invoice.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
