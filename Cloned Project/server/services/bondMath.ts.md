# `server/services/bondMath.ts`

> Derived figures for a HiFi bond instrument (spec §3 + §7).

**Kind:** backend service · **Lines:** 228

<!-- docgen:auto -->

## Purpose
Derived figures for a HiFi bond instrument (spec §3 + §7).

Pure: no DB, no IO, no floats. Everything here is BigInt arithmetic on
atomic-unit strings, so it is directly unit-testable and safe to call
on every keystroke from the builder's preview endpoint.

The single most important thing this module exists for is spec §7: a
founder entering "1% / daily / 90 days" is committing to pay out far
more than they take in, and nothing on the create screen tells them.
`deriveInstrumentFigures` is that number.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PAYOUT_FREQUENCIES` | const | `= [ "daily", "monthly", "quarterly", "half_yearly", "yearly", ] as const` | 19 |
| `PayoutFrequency` | type |  | 26 |
| `PAYOUT_PERIOD_DAYS` | const | `= { daily: 1, monthly: 30, quarterly: 90, half_yearly: 180, yearly: 360, }` — Period length in days. | 37 |
| `DAYS_PER_YEAR` | const | `= 360` | 45 |
| `CommissionBasis` | type |  | 47 |
| `InstrumentInput` | interface |  | 49 |
| `DerivedFigures` | interface |  | 64 |
| `payoutCountFor` | function | `payoutCountFor(durationDays: number, frequency: PayoutFrequency): number` | 92 |
| `stubDaysFor` | function | `stubDaysFor(durationDays: number, frequency: PayoutFrequency): number` | 99 |
| `isWholeMultipleOfPeriod` | function | `isWholeMultipleOfPeriod(durationDays: number, frequency: PayoutFrequency): boolean` — Spec §8: simplest resolution of a frequency/duration mismatch is to block the combination at creation. | 108 |
| `deriveInstrumentFigures` | function | `deriveInstrumentFigures(input: InstrumentInput): DerivedFigures` | 131 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/config/bondMoney.ts` — `BondCurrency`, `addAtomic`, `mulUnits`, `percentOf`
- **Packages:** none

## Used by

- `server/models/bondInstrument.model.ts`
- `server/routes/bond.ts`
- `server/services/__tests__/bondMath.test.ts`
- `server/services/bondInvoiceFulfillment.ts`
- `server/services/bondValidation.ts`
- `server/services/bondView.ts`
