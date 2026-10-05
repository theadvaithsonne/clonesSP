# `server/scripts/retro-distribute-office-pro-invoice.ts`

> Retro-fire the Pro-plan commission for an office_plan Pro invoice that was paid but never distributed (cryptobrand-bootstrap wallet/ crypto path pre-fix).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 65

<!-- docgen:auto -->

## Purpose
Retro-fire the Pro-plan commission for an office_plan Pro invoice
that was paid but never distributed (cryptobrand-bootstrap wallet/
crypto path pre-fix).

Idempotent — calls the same distributeProOfficeCommissionForInvoice
that fulfillInvoice("office_plan") now calls at runtime. Re-runs no-op
via metadata.officeProCommissionAt + wallet dedupeKey guards.

Usage:
  npx tsx src/scripts/retro-distribute-office-pro-invoice.ts <invIdOrNumber>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`, `findOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/retro-distribute-office-pro-invoice.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
