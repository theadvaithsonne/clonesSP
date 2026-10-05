# `server/services/__tests__/bondMath.test.ts`

> Tests: 22 test cases.

**Kind:** test · **Lines:** 229

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Test cases (22)

- **bondMoney — atomic conversion**
  - round-trips whole and fractional values per currency
  - holds an ETH value that overflows Number.MAX_SAFE_INTEGER
  - rounds half-up when parsing beyond a currency's precision
  - refuses to hand an inexact float to the wallet layer
  - rejects negative results rather than silently wrapping
- **bondMoney — percentOf**
  - computes percentages exactly in minor units
  - rounds half-up at the minor unit
  - multiplies per-unit amounts by N, never the reverse (spec §8)
- **bondMath — payout scheduling (spec §8)**
  - 90 days at quarterly = 1 payout
  - 100 days at monthly = 3 payouts plus a 10-day stub
  - uses a 30-day month basis so yearly == monthly x 12
- **bondMath — the spec §5 worked example, under decision D2**
  - pays Rs10 per day for 90 days = Rs900 interest
  - charges Rs10 principal commission once
  - charges Rs0.10 per payout — 1% of the PAYOUT, not the unit price
  - totals Rs1,919 outflow and a seller net of -Rs919
  - annualises 1% daily as 360%
- **bondMath — full subscription (spec §7)**
  - scales all five headline figures by totalUnits
- **bondMath — commission basis variants**
  - `none` charges nothing on either leg
  - `principal` charges once and nothing per payout
  - `payout` charges per payout and nothing at purchase
- **bondMath — multi-currency**
  - computes a USDT bond at 6 dp
  - computes an ETH bond in wei without precision loss

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/config/bondMoney.ts` — `toAtomic`, `fromAtomic`, `percentOf`, `mulUnits`, `addAtomic`, `subAtomic`, `toWalletAmount`, `MINOR_UNITS`
  - `server/services/bondMath.ts` — `deriveInstrumentFigures`, `payoutCountFor`, `stubDaysFor`, `isWholeMultipleOfPeriod`, `PAYOUT_PERIOD_DAYS`
- **Packages:** none

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
