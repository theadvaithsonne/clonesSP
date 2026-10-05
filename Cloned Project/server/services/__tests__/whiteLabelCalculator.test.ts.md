# `server/services/__tests__/whiteLabelCalculator.test.ts`

> Tests: 5 test cases.

**Kind:** test · **Lines:** 53

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (5)

- **White Label calculator**
  - screenshot inputs: 3 new, 12 active — $204 per licence before level bonus, no incentive yet
  - volume bonus: 9 → 0, 10 → 1500, 15 → 2250 (uncapped, retroactive)
  - incentive is one-off; years multiplies only the recurring part
  - six units: level and infinity figures are 6× a single licence's
  - split adds up to the $600 price; commission is $306 in code ($150 + 6×$25 + $6), not the $300 the config comments claim

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/whiteLabelCalculator.ts` — `calculateWhiteLabelEarnings`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
