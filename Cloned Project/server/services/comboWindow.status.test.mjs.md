# `server/services/comboWindow.status.test.mjs`

> Tests: 5 test cases.

**Kind:** test · **Lines:** 31

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (5)

- not_started when no profileCompletedAt and no override
- open while inside the natural 24h
- expired after the natural 24h
- completed when UP purchased inside the window (beats open/expired)
- purchase after expiry is NOT completed

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Relative imports that did not resolve to a file:** `../../dist/services/comboWindow.js`
- **Packages:**
  - `node:test` — `test`
  - `node:assert`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
