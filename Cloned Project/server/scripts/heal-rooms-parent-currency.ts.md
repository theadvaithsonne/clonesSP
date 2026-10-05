# `server/scripts/heal-rooms-parent-currency.ts`

> Flip legacy `office_addon_subscription` parent invoices from `itemCurrency: "INR"` (or any non-USD) to `"USD"`.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 94

<!-- docgen:auto -->

## Purpose
Flip legacy `office_addon_subscription` parent invoices from `itemCurrency:
"INR"` (or any non-USD) to `"USD"`. Bug: the old
`createInitialRoomsParentInvoice` pulled currency from the Pro plan doc,
which is `INR` for Indian orgs — but the unit price is a USD-cents
constant ($5 = 500), so those invoices silently displayed as ₹5 instead
of $5. Fix: rooms are always priced in USD; the payment layer handles
conversion at checkout.

Only touches the RECURRING PARENT (`parentInvoiceId` unset). Paid CHILD
invoices from prior cycles are left alone — the money already moved
through Razorpay at the (wrong) INR value; rewriting the stamp would
mislead audit.

Usage:
  npx ts-node --transpile-only src/scripts/heal-rooms-parent-currency.ts
  npx ts-node --transpile-only src/scripts/heal-rooms-parent-currency.ts --apply

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
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/heal-rooms-parent-currency.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Invoice` (updateOne).
- Command-line flags referenced: `--apply`.
