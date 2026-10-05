# `server/scripts/fix-child-board-seq-numbers.ts`

> Fix child boards of "6-1001" to correct even/odd sequence rule: Left = even sequence → "6-1002 L" Right = odd sequence → "6-1003 R"

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 54

<!-- docgen:auto -->

## Purpose
Fix child boards of "6-1001" to correct even/odd sequence rule:
  Left  = even sequence → "6-1002 L"
  Right = odd  sequence → "6-1003 R"

Run: npx tsx src/scripts/fix-child-board-seq-numbers.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `findOne`, `find`; **writes:** `updateOne`
  - `Bat246Config` (server/bat246/models/bat246Config.model.ts) — reads: `findOne`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
  - `server/bat246/models/bat246Config.model.ts` — `Bat246Config`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/fix-child-board-seq-numbers.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246Board` (updateOne); `Bat246Config` (updateOne).
