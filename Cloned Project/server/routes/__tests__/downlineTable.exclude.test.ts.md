# `server/routes/__tests__/downlineTable.exclude.test.ts`

> Tests: 3 test cases.

**Kind:** test · **Lines:** 33

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (3)

- exclusion hides everyone BENEATH the named people, not the people
- repeated params and comma lists both work
- a malformed id excludes nobody rather than emptying or widening the table

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/routes/downlineTable.ts` — `excludeBeneathClause`
- **Packages:**
  - `node:assert`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
