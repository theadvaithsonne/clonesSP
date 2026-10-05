# `server/services/__tests__/redemptionScope.test.ts`

> Tests: 9 test cases.

**Kind:** test · **Lines:** 96

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (9)

- **redemption scope**
  - files a multi-cycle coupon on the ROOT when redeemed at the root
  - files a multi-cycle coupon on the ROOT even when redeemed at a RENEWAL
  - never files a multi-cycle coupon under invoiceId, from anywhere
  - keeps a single-cycle coupon on a new subscription at the root
  - keeps a single-cycle coupon on a renewal scoped to that invoice ALONE
  - scopes a one-time purchase to its own invoice
  - treats a missing cycleCount as one cycle, not unlimited
  - returns exactly one key, never both
  - accepts ObjectId-ish values, not just strings

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/platformCoupon.ts` — `redemptionScopeFor`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
