# `server/scripts/patch-invoice-undefined-label.ts`

> Targeted patch for INV-MT2T5TAC-Q1ZL (philip).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 103

<!-- docgen:auto -->

## Purpose
Targeted patch for INV-MT2T5TAC-Q1ZL (philip). The past-window monthly
combo path in routes/unilevel-plus.ts used to template raw `termMonths`
(undefined) into the line-item text, rendering:
  name: "Unilevel Plus + undefined months of NetworkChain"
  desc: "$25 Unilevel Plus licence + undefined-month GU_SUB_36 subscription ($36), with the first month free"

The bug is fixed for future invoices. This one is already minted; patch
lineItems[0].itemName / itemDescription in place. Money fields untouched.

Reads the invoice's own metadata (combo.termMonths, bundle.subUsd, etc)
to build the correct strings — no hardcoding.

Usage:
  npx tsx src/scripts/patch-invoice-undefined-label.ts <invoiceId>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findById`; **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/patch-invoice-undefined-label.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Invoice` (updateOne).
