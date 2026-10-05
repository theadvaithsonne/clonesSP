# `server/scripts/repair-foundersoffice-activation.ts`

> ONE-OFF: Deliver the office months that FOUNDERSOFFICE paid for but never activated.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 143

<!-- docgen:auto -->

## Purpose
ONE-OFF: Deliver the office months that FOUNDERSOFFICE paid for but never activated.

BACKGROUND
  Org 6a0207e0e7ce4252ed4b1d17 (Techworlds, founder techworldsdata@gmail.com)
  redeemed FOUNDERSOFFICE — 100% off, 12 cycles — on 2026-09-01. A recurring
  cascade burned all 12 cycles in 3 seconds. Every cycle:
    ✅ was marked `paid`
    ✅ fired the Office Pro commission ($888 total, since reversed)
    ❌ activated NOTHING — `fulfillInvoice`'s office_plan case only ran the
       commission and returned "payment_recorded"

  Result: the coupon is spent (cyclesApplied 11/12, expired 2026-09-01
  17:34), the founder has no office, and on 2026-09-02 he was issued a
  fresh $113.28 invoice for the thing he had already redeemed.

WHAT THIS DOES […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/repair-foundersoffice-activation.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
