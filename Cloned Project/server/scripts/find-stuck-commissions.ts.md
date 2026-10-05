# `server/scripts/find-stuck-commissions.ts`

> Find every PAID whitelabel_addon / cryptosub invoice where the commission never fired (whitelabelCommissionAt / cryptosubCommissionAt absent) — i.e., stuck-state invoices victim of the E11000 bug we just fixed.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 80

<!-- docgen:auto -->

## Purpose
Find every PAID whitelabel_addon / cryptosub invoice where the
commission never fired (whitelabelCommissionAt / cryptosubCommissionAt
absent) — i.e., stuck-state invoices victim of the E11000 bug we
just fixed.

Read-only. Doesn't touch anything.

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
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/find-stuck-commissions.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
