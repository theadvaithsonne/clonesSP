# `server/services/__tests__/founderProductCalculator.test.ts`

> Tests: 15 test cases.

**Kind:** test · **Lines:** 255

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (15)

- **founder product calculator — levels kind**
  - pays each level its founder-set share of the full price
  - sales deeper than the founder's table pay nothing and are called out
  - duplication model: level-L sales = directs × dup^(L-1) × salesPerPerson
  - months multiplies the total, never the monthly figure
  - refuses a table over the 90% founder cap, same as commission.ts
  - refuses a non-positive price
- **founder product calculator — unilevel_plus kind**
  - is the default kind — a founder assigns the UP comp plan and one percentage
  - splits the founder's pool by the tree's percentages, minus what returns to the founder
  - direct bonus only on level-1 purchases; infinity locked under 4 legs
  - level bonus: the point value scales to the pool, so a small sale still pays all 15 levels
  - on a $25 pool the level pool covers all 15 levels, same as a licence sale
  - infinity per-recipient amounts scale by pool/$25 but never above 1×
  - infinity is a headcount gate: 4+/10+ UP-active directs qualifies EVERY sale below you
  - requires the plan
  - refuses over the 90% cap

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/founderProductCalculator.ts` — `calculateFounderProductEarnings`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
