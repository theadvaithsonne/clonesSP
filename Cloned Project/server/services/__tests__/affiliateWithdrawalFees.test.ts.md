# `server/services/__tests__/affiliateWithdrawalFees.test.ts`

> Tests: 9 test cases.

**Kind:** test · **Lines:** 86

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (9)

- **affiliate withdrawal fee matrix**
  - prices the four configured outcomes exactly as specified
  - keeping MORE than $50 still earns the lower tier
  - one cent under $50 does NOT earn it
  - an unconfigured user stays on the historical 5%, not a silent discount
  - a saved weekly preference with no keep is 2% — cheaper than the unconfigured default
  - treats a negative keep as zero rather than inverting the tier
  - the payout method changes the LABEL, never the Garage percentage
  - renders the exact wording the product asked for
  - the grid covers every combination once

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/config/affiliateWithdrawalFees.ts` — `resolveAffiliateFeeTier`, `affiliateFeeMatrix`, `describeAffiliateFee`, `AFFILIATE_KEEP_THRESHOLD_CENTS`, `AFFILIATE_DEFAULT_FEE_PERCENT`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
