# `server/services/__tests__/igniteCall.service.test.ts`

> Tests: 18 test cases.

**Kind:** test · **Lines:** 126

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (18)

- **chunk**
  - splits into batches of at most the given size
  - returns no batches for an empty list
  - keeps a list smaller than the size as one batch
- **newestLiveCall**
  - picks the latest scheduledAt
  - ignores detached calls even when they are newest
  - returns null when every call is detached
  - returns null for an empty history
- **enrichStatuses**
  - returns a map keyed by scheduleId
  - chunks requests at NC_STATUS_CHUNK
  - every id in a 200-row export page gets a status
  - fails soft to an empty map when NetworkChains errors
  - keeps the batches that succeeded when one batch fails
  - does not call NetworkChains at all for an empty id list
- **applyManualCompletion**
  - leaves the derived status alone when there is no override
  - promotes a scheduled call to completed
  - is a no-op on a call that is already completed
  - does NOT override a call that is live right now
  - cannot conjure a status for an affiliate with no call

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/igniteCall.service.ts` — `chunk`, `newestLiveCall`, `enrichStatuses`, `NC_STATUS_CHUNK`, `applyManualCompletion`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
