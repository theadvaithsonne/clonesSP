# `server/scripts/seedPincodes.ts`

> One-time seed: populate PincodeData collection with Indian PIN codes.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 447

<!-- docgen:auto -->

## Purpose
One-time seed: populate PincodeData collection with Indian PIN codes.
Covers all 28 states + 8 Union Territories.

Run:  npx tsx src/scripts/seedPincodes.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `PincodeData` (server/models/pincodeData.model.ts) — reads: `countDocuments`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/pincodeData.model.ts` — `PincodeData`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/seedPincodes.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `PincodeData` (updateOne).
