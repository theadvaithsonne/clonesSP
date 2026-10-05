# `server/scripts/patch-board-cards-and-tracking.ts`

> One-time patch for the dev/test board (boardNumber=1): - Change trackingNumber → "6-1001" - Home Plate: grayCards=2, cardType="Gold", brownCards=1, blackCards=1 - 3rd Base: grayCards=1, blackCards=1 - 2nd Base A: cardType="Gold"

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 101

<!-- docgen:auto -->

## Purpose
One-time patch for the dev/test board (boardNumber=1):
  - Change trackingNumber → "6-1001"
  - Home Plate: grayCards=2, cardType="Gold", brownCards=1, blackCards=1
  - 3rd Base:   grayCards=1, blackCards=1
  - 2nd Base A: cardType="Gold"

Uses a loose schema so grayCards (not in strict model) is persisted.

Run: npx tsx src/scripts/patch-board-cards-and-tracking.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `LooseBoard246`

- **Collection:** `bat246boards`
- **Schema options:** `strict: false`

| Field | Type | Flags |
|---|---|---|

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/patch-board-cards-and-tracking.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
