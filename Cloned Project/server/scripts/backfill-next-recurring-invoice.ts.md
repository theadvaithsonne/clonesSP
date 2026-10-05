# `server/scripts/backfill-next-recurring-invoice.ts`

> Backfill the next recurring child invoice for already-PAID parent subscriptions.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 103

<!-- docgen:auto -->

## Purpose
Backfill the next recurring child invoice for already-PAID parent
subscriptions.

The on-payment trigger in fulfillInvoice (→ generateNextChildInvoice) only
fires for NEW payments. Subscriptions paid BEFORE that trigger shipped have
no next "draft" invoice yet, and the daily cron only mints it ~5 days before
due — so this catches them up now (e.g. to test the Subscription page's
"Due" row without waiting for renewal or a fresh payment).

Idempotent: generateNextChildInvoice dedups on (parentInvoiceId,
recurringPaymentNumber), so re-running is safe and never double-creates.

Usage (from roam-backend/):
  npx tsx src/scripts/backfill-next-recurring-invoice.ts <customerEmail>
  npx tsx src/scripts/backfill-next-recurring-invoice.ts --all
  # add --dry to only LIST eligible parents, creating nothing: […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/services/invoice.ts` — `generateNextChildInvoice`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-next-recurring-invoice.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--dry`, `--all`.
