# `server/scripts/seedBat246FreeCoupon.ts`

> Creates the BAT264FREE platform coupon (100% off, productType: "product").

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 57

<!-- docgen:auto -->

## Purpose
Creates the BAT264FREE platform coupon (100% off, productType: "product").
Works for both the $20 annual membership and $650 Bat246 entry product.

Run:  npx tsx src/scripts/seedBat246FreeCoupon.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/seedBat246FreeCoupon.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `PlatformCoupon` (create).
