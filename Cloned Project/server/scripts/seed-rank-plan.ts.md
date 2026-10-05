# `server/scripts/seed-rank-plan.ts`

> Seed the NetworkChain rank bonus plan.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 109

<!-- docgen:auto -->

## Purpose
Seed the NetworkChain rank bonus plan.

Usage:
  npx tsx -r dotenv/config src/scripts/seed-rank-plan.ts <thirdPartyClientId> [--dry-run]
  npx tsx -r dotenv/config src/scripts/seed-rank-plan.ts --show     (read-only)

Inserts a NEW version and deactivates the previous one — plans are never
edited in place, so a past RankRun's `planVersion` always resolves to the
numbers that actually paid.

Amounts are DOLLARS. Bronze stacks with every rank, so a Silver is paid
40 + 200 = $240, a Platinum 40 + 10,000 = $10,040.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `RankPlan` (server/models/rankPlan.model.ts) — reads: `find`, `findOne`; **writes:** `new + save`, `updateMany`
  - `RANK_KEYS` (server/models/rankPlan.model.ts) — referenced
- **Environment variables (`process.env`):** `MONGODB_URI`, `MONGO_URI`

## Dependencies

- **Internal:**
  - `server/models/rankPlan.model.ts` — `RankPlan`, `RANK_KEYS`, `payoutFor`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/seed-rank-plan.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `RankPlan` (new + save, updateMany).
- Command-line flags referenced: `--dry-run`, `--show`.
