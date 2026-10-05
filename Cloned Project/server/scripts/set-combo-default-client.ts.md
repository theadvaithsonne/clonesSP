# `server/scripts/set-combo-default-client.ts`

> Names the third-party client that the Unilevel Plus combo offer sells.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 94

<!-- docgen:auto -->

## Purpose
Names the third-party client that the Unilevel Plus combo offer sells.

The free-first-month fallback used to identify that client by it being the
ONLY active one. Activating a second client (GarageGo, 10 Sep 2026) made
that condition false, and from that moment bare-licence buyers silently
stopped getting both their UPI mandate and their free month.

services/comboClient.ts now resolves it by an explicit `isComboDefault`
flag, falling back to the old sole-active rule. This script sets the flag,
which is what makes the fix take effect on an installation that already has
more than one active client.

  npx tsx src/scripts/set-combo-default-client.ts                    (dry run)
  npx tsx src/scripts/set-combo-default-client.ts --apply
  npx tsx src/scripts/set-combo-default-client.ts --name GarageGo --apply

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-combo-default-client.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`, `--name`.
