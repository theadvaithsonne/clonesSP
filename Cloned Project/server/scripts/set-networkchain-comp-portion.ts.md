# `server/scripts/set-networkchain-comp-portion.ts`

> Shift the NetworkChain Unilevel Plus comp portion.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 116

<!-- docgen:auto -->

## Purpose
Shift the NetworkChain Unilevel Plus comp portion.

Usage:
  npx tsx -r dotenv/config src/scripts/set-networkchain-comp-portion.ts <clientId> <upPortion> [--dry-run]

e.g.  ... 69e1d6109247c7bd0693ee3b 6

The rank bonus plan's economics require $6, not the deployed $12 — at $12 the
densest possible tree yields 1.7% margin; at $6 it yields 19.9%.

THIS IS A LIVE ECONOMICS CHANGE. It halves what every current affiliate earns
on every NetworkChain subscription, immediately and including renewals of
existing subscriptions — `upPortion` is read from live config at distribution
time, not stamped per-subscription. Announce it before running.

`platformPortion` moves in the opposite direction so the two still sum to […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `findById`
- **Environment variables (`process.env`):** `MONGODB_URI`, `MONGO_URI`

## Dependencies

- **Internal:**
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-networkchain-comp-portion.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--dry-run`.
