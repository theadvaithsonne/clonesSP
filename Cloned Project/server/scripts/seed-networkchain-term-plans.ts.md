# `server/scripts/seed-networkchain-term-plans.ts`

> Seed multi-month term plans onto a third-party client.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 197

<!-- docgen:auto -->

## Purpose
Seed multi-month term plans onto a third-party client.

Usage:
  npx tsx src/scripts/seed-networkchain-term-plans.ts <clientId> [--activate]

Without --activate, only the 1-month term is sellable. That is the intended
initial state: 3/6/12 stay `isActive: false` until NetworkChain confirms their
webhook handler reads `termMonths` / `periodEnd`. Until then a 12-month buyer
would be granted one month of access on their side.

Idempotent — rewrites the whole termPlans array from the client's own monthly
scalars, so re-running after a price change keeps everything consistent.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `ThirdPartyClient` (server/models/thirdPartyClient.model.ts) — reads: `find`, `findById`
- **Environment variables (`process.env`):** `MONGODB_URI`, `MONGO_URI`

## Dependencies

- **Internal:**
  - `server/models/thirdPartyClient.model.ts` — `ThirdPartyClient`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/seed-networkchain-term-plans.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--activate`, `--dry-run`, `--list`.
