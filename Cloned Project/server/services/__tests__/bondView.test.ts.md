# `server/services/__tests__/bondView.test.ts`

> Tests: 13 test cases.

**Kind:** test · **Lines:** 137

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (13)

- **bond hash**
  - is 12 digits and never starts with 0
  - does not repeat across a large sample
  - accepts search-box input with spaces, dashes or #
  - rejects anything that cannot be a bond hash
- **bond summary — the spec's worked example**
  - counts payments till date and remaining
  - totals paid and remaining interest exactly
  - reports value, earning power and ROI
  - charges the buyer no fees
  - converts to USD at the given rate, and degrades to null without one
  - points at the earliest scheduled payout
- **bond summary — edge cases**
  - still counts an exhausted (failed) payout as owed
  - divides a monthly payout into a daily rate
  - handles a BTC bond like the design

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/bondHash.ts` — `generateBondHash`, `normalizeBondHash`
  - `server/services/bondView.ts` — `computeBondSummary`
  - `server/config/bondMoney.ts` — `toAtomic`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
