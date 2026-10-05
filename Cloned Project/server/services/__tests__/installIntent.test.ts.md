# `server/services/__tests__/installIntent.test.ts`

> Tests: 10 test cases.

**Kind:** test · **Lines:** 126

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (10)

- **install-intent claim**
  - claims this device's row
  - GarageIRL claims only rows parked for GarageIRL
  - a lone stranger's row on the same IP is not handed over
  - a different timezone is a different device
  - the stranger is skipped, this device's row still wins
  - landscape and portrait are the same screen
  - a side that reports nothing stays claimable
  - screen is not enforced on Android (the app's window excludes the bars)
  - the claim records who redeemed it, and a re-claim asks for exactly that
  - another phone on the network re-claims under a different key

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/installIntent.model.ts` — `InstallIntent`
  - `server/services/installIntent.ts` — `claimIntent`, `Fingerprint`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
