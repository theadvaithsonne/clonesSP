# `server/services/__tests__/commissionForfeiture.test.ts`

> Tests: 11 test cases.

**Kind:** test · **Lines:** 98

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (11)

- **commission forfeiture — splitting**
  - splits a clean amount in half
  - gives the indivisible remainder to the MEMBER, never the platform
  - splits a sub-cent level bonus without destroying it
  - always adds back to the gross — no money invented or destroyed
  - forfeits everything at 1 and nothing at 0
  - clamps a fraction outside 0..1 rather than paying out negative money
  - treats a zero or negative gross as nothing to split
  - reproduces today's NetworkChain half on a $25 direct bonus
- **commission forfeiture — labels**
  - names a reason for every case the member can hit
  - says what was lost and why, without an upsell on every row
  - falls back rather than rendering undefined to a member

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/commissionForfeiture.ts` — `splitForfeiture`, `describeForfeiture`, `FORFEITURE_LABELS`, `ForfeitureReason`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
