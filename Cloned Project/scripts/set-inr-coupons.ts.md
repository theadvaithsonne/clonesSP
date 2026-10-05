# `scripts/set-inr-coupons.ts`

> One-off script that sets `currency: "INR"` on the platform coupon `RAW100FLAT` in the **production** database.

**Kind:** backend helper/test script (writes to the configured DB) · **Lines:** 24

## Purpose
Platform coupons live in the `platformcoupons` collection. A fixed-amount coupon is interpreted in its `currency`; `RAW100FLAT` needed to be an INR coupon rather than the default. This script patches that field directly instead of going through the admin UI. It is run by hand and imported by nothing.

## How it works
- Loads `.env` and connects to `MONGODB_URI` (production here).
- `platformcoupons.updateMany({ code: { $in: ["RAW100FLAT"] } }, { $set: { currency: "INR" } })` and prints the modified count.
- Exits 1 on error.

The list of codes is an array, so more codes can be added to the `$in` before running.

## Exports
None.

## Interfaces
- **Database (production):** collection `platformcoupons` - update `currency` on matching coupons (raw collection, no model hooks).
- **Environment variables:** `MONGODB_URI` - target database.

## Dependencies
- **Packages:** `mongoose` - connection and raw collection; `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually: `npx tsx scripts/set-inr-coupons.ts`.

## Notes
- Idempotent; there is no undo mode.
