# `server/scripts/reverse-foundersoffice-cascade.ts`

> ONE-OFF: Reverse the commission paid on the FOUNDERSOFFICE cascade.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 378

<!-- docgen:auto -->

## Purpose
ONE-OFF: Reverse the commission paid on the FOUNDERSOFFICE cascade.

WHAT HAPPENED
  On 2026-09-01 a single Office Pro subscription (org 6a0207e0e7ce4252ed4b1d17,
  buyer techworldsdata@gmail.com) burned 12 billing cycles in 3 seconds.
  FOUNDERSOFFICE is 100%-off with cycleCount 12; every cycle invoiced $0, a
  $0 invoice is marked `paid` instantly with no gateway, and paying a
  recurring child mints the next cycle — a self-feeding loop that ran until
  the coupon's 12 cycles were exhausted.

  Each cycle fired the Office Pro commission, because
  services/officeProInvoiceCommission.ts reads `invoice.subtotal` (the LIST
  price, 9600) and never `totalAmount` (what was COLLECTED, 0):

      const baseUsd       = (invoice.subtotal || 0) / 100;  // 96
      const upSaleUsd     = 24;   // hardcoded […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `invoices`, `wallettransactions`, `unilevelplusdistributions`, `users`, `affiliatewallets`, `storewallets`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/reverse-foundersoffice-cascade.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`, `--allow-negative`.
