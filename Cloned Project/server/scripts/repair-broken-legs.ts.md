# `server/scripts/repair-broken-legs.ts`

> Repair downline rows whose `leg` column renders blank.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 238

<!-- docgen:auto -->

## Purpose
Repair downline rows whose `leg` column renders blank.

`leg` is not stored — the downline table derives it by walking the row's
`ancestors` to the entry just below the root, then looking that id up among
the root's live directs (`referredBy: root`). It renders blank whenever that
lookup misses, which happens two ways, and they need opposite fixes:

  ORPHANED  the upline in the middle of the chain has been DELETED, so
            `ancestors` (and `referredBy`) point at a user record that no
            longer exists. There is nothing to reattach to, so these move to
            an explicit target — by default the root itself.

  DRIFTED   the row's `referredBy` names a user who DOES exist, but the
            denormalised tree (`ancestors`/`depth`) puts them somewhere else.
            The referrer is the source of truth, so the fix is to make the
            tree agree with it — no target needed, and no judgement call. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `find`, `findById`; **writes:** `updateOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/services/downlineTree.ts` — `reparentUnderNewReferrer`, `refreshTypeFlags`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/repair-broken-legs.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (updateOne).
- Command-line flags referenced: `--confirm`, `--root`, `--orphan-target`.
