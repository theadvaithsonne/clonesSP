# `server/scripts/teamforce-backfill-clock.ts`

> Teamforce historical clock-in / clock-out backfill.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 265

<!-- docgen:auto -->

## Purpose
Teamforce historical clock-in / clock-out backfill.

One-shot script that fills in missing TimeTracking sessions for the
configured users for every IST calendar day between START (default
2026-06-10) and END (default yesterday IST). Same randomisation as the
live daemon: clock-in is picked uniformly inside 09:45–10:00 IST and
clock-out inside 19:00–19:15 IST. Idempotent — skips days the user
already has a session for, so reruns are safe.

Usage:
  # Dev (tsx)
  npx tsx src/scripts/teamforce-backfill-clock.ts

  # Prod (after npm run build)
  node dist/scripts/teamforce-backfill-clock.js
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `TimeTracking` (server/models/timeTracking.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `TF_BACKFILL_DRY_RUN`, `TF_CLOCK_ORG_ID`, `TF_BACKFILL_INCLUDE_TODAY`, `TF_BACKFILL_START`, `TF_BACKFILL_END`, `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/timeTracking.model.ts` — `TimeTracking`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose` — `Types`
  - `path`
  - `dotenv` — `config as dotenvConfig`

## Used by

Entry: run through `npm run teamforce:backfill-clock`, `npm run teamforce:backfill-clock:prod`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `TimeTracking` (create).
