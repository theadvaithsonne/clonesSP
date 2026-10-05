# `server/scripts/backfill-combo-free-month.ts`

> Grant the 24-hour free-first-month combo to buyers whose checkout never stamped the intent.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 245

<!-- docgen:auto -->

## Purpose
Grant the 24-hour free-first-month combo to buyers whose checkout never
stamped the intent.

Two checkout endpoints mint the $25 Unilevel Plus invoice and only
`/checkout/create-combo-invoice` stamps `metadata.combo`. `fulfillInvoice`
gates the free month on that field, so anyone routed through
`/checkout/create-order` silently missed the offer regardless of how fast
they paid — one buyer paid two minutes after completing his profile and got
nothing. services/invoice.ts now re-checks the window at fulfilment so this
cannot recur; this script settles the people who already missed out.

Eligibility — all four must hold:
  1. an ACTIVE UnilevelPlusPurchase they PAID for (paymentId not `assigned_`,
     so reserve-gifted seats are excluded — nobody paid for those)
  2. the 24h window was OPEN at their purchase moment (comboWindowFor,
     honouring any admin offerExpiresAtOverride) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/services/comboClient.ts` — `resolveComboClient`, `comboClientProblem`
  - `server/services/comboWindow.ts` — `comboWindowFor`
  - `server/services/comboActivation.ts` — `activateComboFreeFirstMonth`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-combo-free-month.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--confirm`.
