# `server/scripts/preview-rank-bonus.ts`

> READ-ONLY preview of what a rank-bonus run would produce.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 123

<!-- docgen:auto -->

## Purpose
READ-ONLY preview of what a rank-bonus run would produce.

Usage:
  npx tsx -r dotenv/config src/scripts/preview-rank-bonus.ts <thirdPartyClientId>

Writes NOTHING — no RankRun, no RankQualification, no wallet movement. Runs
the same active-paid predicate and the same qualification pass the real job
uses, and reports the qualifier list and the bill.

This is the gate described in NETWORKCHAIN_RANK_BONUS_PLAN.md §6.4: look at
the real numbers before any money moves. There is no reversal machinery in
this codebase, so a wrong payout cannot be undone.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `MONGODB_URI`, `MONGO_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/rankPlan.model.ts` — `RANK_KEYS`
  - `server/services/rankBonus/activeSubscribers.ts` — `getActivePaidSubscribers`
  - `server/services/rankBonus/qualify.ts` — `qualifyTree`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/preview-rank-bonus.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
