# `server/scripts/heal-stuck-rooms-parents.ts`

> Heal conference-room parent invoices that were lazy-created after signup (via POST /conference-rooms → applyAddRoomsBilling) and got stuck at `status: "draft"` because the previous code path never marked them paid.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 126

<!-- docgen:auto -->

## Purpose
Heal conference-room parent invoices that were lazy-created after signup
(via POST /conference-rooms → applyAddRoomsBilling) and got stuck at
`status: "draft"` because the previous code path never marked them paid.

Consequence of the stuck state: `generateNextChildInvoice` early-returns
on unpaid parents, so the recurring cycle never fires. Founder pays the
one-off prorated invoice once and then never gets billed again for that
room. This script identifies those parents, verifies the founder actually
paid the corresponding prorated one-off, then flips the parent to
`paid` so the cron picks up cycle 2 on the next `nextDueDate`.

Two modes:
  default = dry-run, `--apply` = writes.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/invoice.model.ts` — `Invoice`
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/heal-stuck-rooms-parents.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Invoice` (updateOne).
- Command-line flags referenced: `--apply`.
