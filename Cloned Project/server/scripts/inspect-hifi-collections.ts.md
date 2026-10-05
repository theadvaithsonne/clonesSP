# `server/scripts/inspect-hifi-collections.ts`

> One-shot: sample the hifi_* collections in roam-admin-prod so we know the exact field shape before wiring the invoice-payment integration.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 46

<!-- docgen:auto -->

## Purpose
One-shot: sample the hifi_* collections in roam-admin-prod so we know
the exact field shape before wiring the invoice-payment integration.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/inspect-hifi-collections.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
