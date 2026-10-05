# `server/scripts/move-upline.ts`

> Move a member under a new upline, keeping the denormalised tree in step.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 189

<!-- docgen:auto -->

## Purpose
Move a member under a new upline, keeping the denormalised tree in step.

Does what the fixed /garage-admin/users/:id/move-upline now does:
  1. repoint `referredBy`
  2. `reparentUnderNewReferrer` — ancestors, depth, legNumber, and the
     directsCount/downlineCount on BOTH the old and new chains
  3. `refreshTypeFlags`

Also repairs members already left stale by the old endpoint, which wrote
only `referredBy`: pass --repair-only to fix the tree without moving anyone.

Commissions are NOT touched. This only affects FUTURE earnings, same as the
admin endpoint. To re-point an already-paid distribution, run
move-unilevel-commission.ts afterwards.

Safe by default: prints what it WOULD change and exits. Pass --confirm to write. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`; **writes:** `findByIdAndUpdate`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/services/downlineTree.ts` — `reparentUnderNewReferrer`, `refreshTypeFlags`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/move-upline.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (findByIdAndUpdate).
- Command-line flags referenced: `--confirm`, `--repair-only`.
