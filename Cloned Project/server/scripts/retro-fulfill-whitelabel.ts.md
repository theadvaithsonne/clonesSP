# `server/scripts/retro-fulfill-whitelabel.ts`

> Retro-run the whitelabel_addon fulfillment on a specific invoice that was PAID but never had its switch case fire (e.g.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 127

<!-- docgen:auto -->

## Purpose
Retro-run the whitelabel_addon fulfillment on a specific invoice
that was PAID but never had its switch case fire (e.g. deployed BE
was stale at payment time). Calls the two side-effects our normal
fulfillInvoice switch case would call, both idempotent:
  1. activateWhitelabelFromInvoice — upserts OfficeAddonSubscription
     so hasActiveAddon flips true. Marked via
     `invoice.metadata.whitelabelActivatedAt`; short-circuits if set.
  2. chargeReferralCommission — 3-bucket split (L1 flat $150 +
     L1..L6 cascade $144 + platform residual $6). Idempotent via
     per-bucket dedupeKeys on each WalletTransaction.

Safe to run against production. Multiple runs on the same invoice
are no-ops (the second run's metadata short-circuit fires first;
even without that, the wallet-side dedupeKey's partial unique index
blocks any double-credit).
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/retro-fulfill-whitelabel.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
