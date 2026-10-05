# `server/services/__tests__/genealogyPure.test.ts`

> Tests: 27 test cases.

**Kind:** test · **Lines:** 220

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (27)

- **memberStatus**
  - applies lapsed > qualified > active > inactive
- **legHeadOf / pathFromRoot**
  - returns the root's direct child on the path
  - returns self when self is a direct of the root
  - returns null when root is not an ancestor
  - builds root → … → self
  - accepts ObjectId-like values
- **money**
  - netMinor strips GST and shipping, never negative
  - minorToUsd converts via a units-per-USD table, rounded to cents
  - minorToUsd returns 0 for an unknown currency
- **periods**
  - monthStart is the UTC first of the month
  - monthRange spans exactly one month
- **levelBucket / rankOrder**
  - caps levels at the 16+ bucket
  - orders ranks Bronze < … < Platinum, unranked lowest
- **buildMatrix**
  - has 16 level rows with one cell per leg
  - counts people/active/qualified/volume per cell
  - totals rows, legs and grand
- **levelHistogram / summarizeLegs**
  - buckets people by level with a 16+ bucket
  - summarizes each leg
- **upEarnings**
  - sums only the caller's credited amounts, falling back to amount
  - addSplits sums fields and rounds to cents
- **ancestorsOf**
  - returns the chain to the root for one deep match
  - excludes the matches themselves
  - drops branches with no match in them
  - merges overlapping chains without repeating a node
  - is empty when the only match is a direct of the root's child chain top
  - survives a parent id that is not in the member list
  - terminates on a cycle rather than hanging

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/genealogy/pure.ts` — `memberStatus`, `legHeadOf`, `pathFromRoot`, `netMinor`, `minorToUsd`, `monthStart`, `monthRange`, `levelBucket`, … +1
  - `server/services/genealogy/pure.ts` — `buildMatrix`, `levelHistogram`, `summarizeLegs`, `upEarnings`, `addSplits`, `emptySplit`, `ancestorsOf`, `TreeMember`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
