# `server/services/__tests__/bondValidation.test.ts`

> Tests: 15 test cases.

**Kind:** test · **Lines:** 130

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (15)

- **bond validation — structure**
  - accepts the spec's worked example
  - blocks a duration that leaves a stub period (spec §8)
  - allows a duration that divides evenly
  - blocks a term shorter than one payout period
  - requires a rate for whichever commission basis is chosen
  - rejects minUnits above total supply
- **bond validation — invoice precision**
  - accepts any INR/USD price (2dp currencies)
  - accepts a crypto price that lands on 2dp
  - rejects a crypto price finer than the invoice layer can record
  - converts to invoice minor units correctly across currencies
- **bond validation — publish acknowledgement (spec §7)**
  - requires an acknowledgement
  - rejects a figure that doesn't match the real obligation
  - accepts the exact figure
- **bond validation — levels must sum to the bond's rate**
  - accepts levels totalling the commission rate
  - rejects a mismatch

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/bondValidation.ts` — `validateInstrument`, `validateAcknowledgement`, `validateLevelsAgainstRate`, `isInvoiceRepresentable`, `toInvoiceMinorUnits`
  - `server/config/bondMoney.ts` — `toAtomic`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
