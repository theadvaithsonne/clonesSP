# `server/services/__tests__/conversionFee.test.ts`

> Tests: 23 test cases.

**Kind:** test · **Lines:** 199

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (23)

- **conversion fee — the spec's worked example**
  - takes 20,000 INR and converts 80,000
  - leaves the gross debit unchanged
- **conversion fee — fee + net === gross, always**
  - holds across every amount x rate combination
  - never lets the fee exceed the gross
- **conversion fee — rounding at 8dp**
  - rounds a fee to the 8th decimal
  - charges nothing when the fee rounds away to dust
  - puts the rounding residue on net, never dangling
  - never reconstructs gross by adding the parts
- **conversion fee — zero and disabled**
  - charges nothing at 0 bps
- **conversion fee — which pairs are chargeable**
  - never charges a true same-currency relocation
  - DOES allow charging stablecoin identity hops
  - charges real conversions
- **conversion fee — founder self-exemption**
  - exempts the payer when they are the beneficiary
  - charges everyone else
- **conversion fee — the spec's §5 blind spot**
  - charges nothing when the fee would ROUND UP to the whole amount
  - still throws on a genuinely corrupt rate (>= 100%)
  - leaves a normal 50% conversion untouched
- **conversion fee — comp-plan split**
  - splits the FEE, not the conversion: 50% of a 2% fee
  - keeps founderShare + compPlanShare === fee
  - gives the founder everything at 0%
  - gives the tree everything at 100%
  - puts the rounding residue on the FOUNDER, never dropped
  - leaves dust with the founder rather than distributing it

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/conversionFee.ts` — `computeFee`, `splitFeeForCompPlan`, `isChargeablePair`, `isFeeExempt`, `round8`, `MAX_FEE_BPS`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
