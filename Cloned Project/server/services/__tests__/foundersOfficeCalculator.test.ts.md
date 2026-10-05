# `server/services/__tests__/foundersOfficeCalculator.test.ts`

> Tests: 7 test cases.

**Kind:** test · **Lines:** 76

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (7)

- **Founders Office calculator**
  - the screenshot's inputs: 10 new, 30 active, no deeper levels
  - volume bonus tiers mirror config: 49 → 0, 50 → 1200, 99 → 2376, 100 → 4800, 150 → 4800
  - volume bonus is one-off: this month includes it, every-month-after does not, total counts it once
  - new sales this month are always counted as active
  - deeper levels earn the tree's level bonus only — no $24 flat, no $9 direct
  - directs default to activeDirectSubs and can be overridden
  - split adds up to the $96 price

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/foundersOfficeCalculator.ts` — `calculateFoundersOfficeEarnings`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
