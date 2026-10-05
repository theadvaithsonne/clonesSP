# `server/scripts/backfill-india-freedom-webinar.ts`

> BACKFILL: enrol every India-based user into "Your Freedom Webinar".

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 164

<!-- docgen:auto -->

## Purpose
BACKFILL: enrol every India-based user into "Your Freedom Webinar".

WHO COUNTS AS INDIAN
  The SAME determination used to decide whether to charge GST —
  `utils/gstBuyerRegion.ts#resolveBuyerGstRegion`. Not a bespoke country
  regex: that resolver already handles "India" / "IN" / casing / trailing
  whitespace, falls back to PIN code and state when country is absent, and
  correctly does NOT match "British Indian Ocean Territory" (7 users) or
  "Indian " (1) — both of which a naive /india/i would sweep in.

  `paymentCurrency` is deliberately NOT passed. Its "INR ⇒ India" fallback
  is right at a checkout, where the buyer just picked a currency, but in a
  backfill there is no payment — supplying one would be inventing a signal.

  Extended by ONE historical GST fact: users with a paid invoice carrying
  `paymentCurrency: "INR"` or `metadata.gst.buyerRegion: "IN"`. We already […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `workshops`, `users`, `invoices`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-india-freedom-webinar.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
