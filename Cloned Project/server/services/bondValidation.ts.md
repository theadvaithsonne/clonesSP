# `server/services/bondValidation.ts`

> Publish-time and purchase-time validation for HiFi bonds.

**Kind:** backend service · **Lines:** 214

<!-- docgen:auto -->

## Purpose
Publish-time and purchase-time validation for HiFi bonds.

Separated from the routes so the rules are unit-testable and stated
once. Every rule here corresponds to a specific clause of the spec.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ValidationIssue` | interface |  | 14 |
| `isInvoiceRepresentable` | function | `isInvoiceRepresentable(atomicAmount: string, currency: BondCurrency): boolean` — The invoice layer stores amounts as a JS number of 1/100ths of a unit (`Math.round(amount * 100)`) for EVERY currency, crypto included. | 30 |
| `toInvoiceMinorUnits` | function | `toInvoiceMinorUnits(atomicAmount: string, currency: BondCurrency): number` — Smallest-unit integer for the invoice line item (2dp convention). | 42 |
| `InstrumentDraft` | interface |  | 53 |
| `validateInstrument` | function | `validateInstrument(d: InstrumentDraft): ValidationIssue[]` — Structural rules — enforced at create AND publish. | 67 |
| `validateAcknowledgement` | function | `validateAcknowledgement(acknowledgedOutflowAtomic: string \| undefined, derivedOutflowAtomic: string, currency: BondCurrency): ValidationIssue[]` — Spec §7: the seller must acknowledge the exact total-outflow figure, not tick a generic "I agree". | 155 |
| `validateLevelsAgainstRate` | function | `validateLevelsAgainstRate(levels: { level: number; percentage: number }[], commissionRatePct: string): ValidationIssue[]` — A `levels` comb plan's percentages must add up to the bond's own commission rate — the founder "enters each percentage and the total, and it should match". | 192 |
| `toAtomic` | export |  | 213 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/config/bondMoney.ts` — `BondCurrency`, `MINOR_UNITS`, `fromAtomic`, `toAtomic`
  - `server/services/bondMath.ts` — `PayoutFrequency`, `isWholeMultipleOfPeriod`, `stubDaysFor`, `PAYOUT_PERIOD_DAYS`
- **Packages:** none

## Used by

- `server/routes/bond.ts`
- `server/services/__tests__/bondValidation.test.ts`
