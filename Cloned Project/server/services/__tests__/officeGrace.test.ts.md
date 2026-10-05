# `server/services/__tests__/officeGrace.test.ts`

> Tests: 9 test cases.

**Kind:** test · **Lines:** 73

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (9)

- **office grace — status derivation**
  - counts down while the window is open
  - rounds the last partial day UP, so an office that still works never reads 0 days
  - locks the instant the window passes
  - a licence outranks everything — including a window that already lapsed
  - an office that was never on the programme is 'none', never 'locked'
  - a corrupt expiry reads as 'none' rather than locking a working office
  - carries the window dates through on every status
- **office grace — window**
  - is exactly OFFICE_GRACE_DAYS long from now
  - a freshly created office reads as 30 days of grace

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/officeGrace.ts` — `graceStatusFor`, `newGraceWindow`, `OFFICE_GRACE_DAYS`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
