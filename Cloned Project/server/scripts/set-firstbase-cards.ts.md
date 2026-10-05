# `server/scripts/set-firstbase-cards.ts`

> Sets specific card values on firstBase slots for Board 1: fb[0] 1st Base A — salesCredits=2 (2 green cards) fb[1] 1st Base B — noCards=1 (1 NoCard) fb[2] 1st Base C — salesCredits=2 (2 green cards) fb[3] 1st Base D — blank (salesCredits=0,…

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 40

<!-- docgen:auto -->

## Purpose
Sets specific card values on firstBase slots for Board 1:
  fb[0] 1st Base A — salesCredits=2 (2 green cards)
  fb[1] 1st Base B — noCards=1 (1 NoCard)
  fb[2] 1st Base C — salesCredits=2 (2 green cards)
  fb[3] 1st Base D — blank (salesCredits=0, noCards=0)

Run: npx ts-node src/scripts/set-firstbase-cards.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `bat246boards`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-firstbase-cards.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
