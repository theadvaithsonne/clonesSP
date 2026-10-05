# `server/scripts/fix-active-board-tracking-numbers.ts`

> Fix active boards' trackingNumber to match their root board's family prefix.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 100

<!-- docgen:auto -->

## Purpose
Fix active boards' trackingNumber to match their root board's family prefix.

Problem: boards split from "6-1001" got "1-101 L" / "1-102 R" because
familyNumber was still 1 when the split ran. This script corrects them.

Logic for each active child board:
  1. Walk parentBoardId chain up to root (no parentBoardId).
  2. Parse root's trackingNumber prefix (e.g. "6" from "6-1001").
  3. If the child's prefix differs, replace it while keeping sequence + side suffix.
     e.g. "1-101 L" → "6-101 L"
  4. Also sync familyNumber to match the prefix integer.

Run: npx tsx src/scripts/fix-active-board-tracking-numbers.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Bat246Board` (server/bat246/models/bat246Board.model.ts) — reads: `find`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` — `Bat246Board`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/fix-active-board-tracking-numbers.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Bat246Board` (updateOne).
