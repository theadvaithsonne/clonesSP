# `server/scripts/verify-split-stats.ts`

> Forward check for the NetworkChain split: a distribution row carrying `creditedAmount` must be reported by getUPCommissionStats at the CREDITED figure, not the plan figure.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 118

<!-- docgen:auto -->

## Purpose
Forward check for the NetworkChain split: a distribution row carrying
`creditedAmount` must be reported by getUPCommissionStats at the CREDITED
figure, not the plan figure.

Uses a synthetic distribution against throwaway ObjectIds and deletes it in
a finally block. It deliberately does NOT call the commission service, which
moves real money and sends push notifications on commit.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGO_URI`, `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`
  - `dns`

## Used by

Entry: run by hand: `npx tsx server/scripts/verify-split-stats.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
