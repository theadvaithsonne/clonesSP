# `server/services/__tests__/adminNotificationEvaluate.test.ts`

> Tests: 9 test cases.

**Kind:** test · **Lines:** 92

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (9)

- **admin notification condition evaluator**
  - the three payment events are registered
  - no conditions fires on every event
  - an empty `any` matches nothing
  - include one downline, exclude a leg inside it
  - isDirectOf reads referredBy, not the whole ancestor path
  - number operators
  - string / enum operators are case-insensitive and `in` takes a comma list
  - boolean operators
  - unknown field, unknown operator, missing user and junk nodes are false

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/adminNotifications/evaluate.ts` — `evaluate`, `EvalUser`
  - `server/config/adminNotificationEvents.ts` — `findEvent`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
