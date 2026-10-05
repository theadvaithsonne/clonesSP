# `server/scripts/verify-drop-commission-split.ts`

> DB-FREE verification of the drop-creator commission carve-out (`applyDropCreatorSplit` in services/commission.ts).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 118

<!-- docgen:auto -->

## Purpose
DB-FREE verification of the drop-creator commission carve-out
(`applyDropCreatorSplit` in services/commission.ts).

This does NOT touch Mongo — it exercises the pure repartition helper the real
distributeCommissions() uses, asserting the invariants that matter for money:
  - creator gets exactly splitPct% of the ORIGINAL pool,
  - levels share the remaining (100-splitPct)%,
  - Σ(all recipients) === original pool to the penny (so seller/platform are
    provably unaffected),
  - no-upline / no-pool / bad id → no split (creator earns nothing).

Run:  npx tsx src/scripts/verify-drop-commission-split.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/commission.ts` — `applyDropCreatorSplit`
- **Packages:**
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/verify-drop-commission-split.ts`.
