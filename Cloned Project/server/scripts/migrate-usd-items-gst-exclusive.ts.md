# `server/scripts/migrate-usd-items-gst-exclusive.ts`

> MIGRATION: flip `gstInclusive` to false on non-INR founder-sold items.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 161

<!-- docgen:auto -->

## Purpose
MIGRATION: flip `gstInclusive` to false on non-INR founder-sold items.

Why this exists
---------------
GST used to be gated on the ITEM's currency: `shouldApplyGstForChannel()`
returned true only for INR, so for a USD-priced item the `gstInclusive`
flag had no effect whatsoever. Every model defaults it to `true`, which
means USD founders are carrying a stored `true` they never considered —
they priced in USD without thinking about Indian GST at all.

GST is now gated on the BUYER's country. Left untouched, that stored
`true` would suddenly mean "my $100 already includes GST", so an Indian
buyer would pay $100 and the founder would net $84.75 — a silent 18% pay
cut on listings priced before the rule existed.

Flipping these to `false` (= "add GST on top") preserves what the founder […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`
  - `dns`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-usd-items-gst-exclusive.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
