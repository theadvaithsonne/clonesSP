# `server/scripts/backfill-assignee-type-flags.ts`

> One-off: recompute typeFlags for users who RECEIVED a reserve-license assignment before services/itemReserveLicense.ts started calling refreshTypeFlags.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 110

<!-- docgen:auto -->

## Purpose
One-off: recompute typeFlags for users who RECEIVED a reserve-license
assignment before services/itemReserveLicense.ts started calling
refreshTypeFlags.

Those users hold an active UnilevelPlusPurchase (paymentId "assigned_…")
but kept typeFlags.oneNetworkActivated === false, so they read as
un-activated prospects in the admin users list and the downline Type column.

Recomputes from source via computeTypeFlags — it derives all three flags from
live purchase/subscription state, so it can only ever set what is already
true. Nothing is invented.

Safe by default: prints what it WOULD change and exits. Pass --confirm to write.

Usage (from roam-backend/):
  npx tsx src/scripts/backfill-assignee-type-flags.ts […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `findById`; **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/services/downlineTypeFlags.ts` — `computeTypeFlags`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-assignee-type-flags.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (updateOne).
- Command-line flags referenced: `--confirm`.
