# `server/services/__tests__/bondSchedule.test.ts`

> Tests: 4 test cases.

**Kind:** test · **Lines:** 31

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (4)

- **bond payout schedule dates**
  - spaces daily payouts one day apart, starting the day after purchase
  - uses whole 30-day periods for monthly
  - lands the final quarterly payout on the 90-day maturity
  - never schedules a payout before the purchase date

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/bondInvoiceFulfillment.ts` — `payoutDueAt`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
