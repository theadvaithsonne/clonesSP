# `server/scripts/reconstruct-firstbase-credits.ts`

> Reconstructs the correct salesCredits for firstBase slots by counting how many AT BAT players have that firstBase player as their referrer.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 83

<!-- docgen:auto -->

## Purpose
Reconstructs the correct salesCredits for firstBase slots by counting
how many AT BAT players have that firstBase player as their referrer.
Prints the reconstructed values, then asks for confirmation before applying.

Run: npx ts-node src/scripts/reconstruct-firstbase-credits.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `bat246boards`
- **Environment variables (`process.env`):** `MONGODB_URI`, `APPLY`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/reconstruct-firstbase-credits.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
