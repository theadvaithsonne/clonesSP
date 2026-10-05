# `server/services/__tests__/bondModels.test.ts`

> Smoke test: the four bond schemas must compile at runtime and carry the indexes the payout engine's correctness depends on.

**Kind:** test · **Lines:** 84

<!-- docgen:auto -->

## Purpose
Smoke test: the four bond schemas must compile at runtime and carry
the indexes the payout engine's correctness depends on.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (5)

- **bond models**
  - register against the expected collections
  - enforces a UNIQUE dedupeKey on payout events
  - indexes the scheduler's hot query
  - validates a draft instrument with derived figures
  - rejects a currency outside the cryptobrand set

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `BondInstrument` (server/models/bondInstrument.model.ts) — **writes:** `new + save`
  - `BondHolding` (server/models/bondHolding.model.ts) — **writes:** `new + save`

## Dependencies

- **Internal:**
  - `server/models/bondInstrument.model.ts` — `BondInstrument`
  - `server/models/bondHolding.model.ts` — `BondHolding`
  - `server/models/bondPayoutEvent.model.ts` — `BondPayoutEvent`
  - `server/models/bondLedgerEntry.model.ts` — `BondLedgerEntry`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
