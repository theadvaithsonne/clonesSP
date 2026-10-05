# `server/services/unilevelPlusCalculator.ts`

> src/services/unilevelPlusCalculator.ts

**Kind:** backend service · **Lines:** 360

<!-- docgen:auto -->

## Purpose
src/services/unilevelPlusCalculator.ts

Pure earnings model for the $25 Unilevel Plus licence. No DB writes, no
side effects — it takes a plan plus a hypothetical org shape and returns
what that shape would pay, with the reasoning attached.

It mirrors services/unilevelPlusCommission.ts rather than inventing a
second set of rules. Where the two could drift, the constants below are
the ones to keep in step:

  direct   — flat `directBonusPercentage` of the sale, to the buyer's
             direct referrer only.
  level    — `legMultiplier × level × pointValue` per sale, walking up to
             `maxLevels`. Multiplier comes from the upline's leg POSITION
             (1st direct → 1×, 2nd → 2×, 3rd and beyond → 3×).
  infinity — a flat amount per qualifying upline, capped at 3 recipients […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CALC_T1_PER_RECIPIENT` | const | `= 0.4` — Kept in step with the same-named constants in unilevelPlusCommission.ts. | 27 |
| `CALC_T2_PER_RECIPIENT` | const | `= 2.0` | 28 |
| `CALC_MAX_RECIPIENTS_PER_TIER` | const | `= 3` | 29 |
| `CALC_T1_MIN_LEGS` | const | `= 4` | 30 |
| `CALC_T2_MIN_LEGS` | const | `= 10` | 31 |
| `CalculatorInput` | interface |  | 33 |
| `LevelRow` | interface |  | 46 |
| `CalculatorResult` | interface |  | 56 |
| `legMultiplier` | function | `legMultiplier(legNumber: number, multipliers: number[]): number` — Leg 1 → 1×, leg 2 → 2×, leg 3+ → 3× (last entry repeats). | 111 |
| `averageLegMultiplier` | function | `averageLegMultiplier(directs: number, multipliers: number[]): number` — Mean multiplier across `directs` legs. | 126 |
| `calculateUnilevelPlusEarnings` | function | `calculateUnilevelPlusEarnings(plan: IUnilevelPlusPlan, input: CalculatorInput): CalculatorResult` | 133 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/unilevelPlusPlan.model.ts` — `IUnilevelPlusPlan`
- **Packages:** none

## Used by

- `server/routes/publicUnilevelPlus.ts`
- `server/services/founderProductCalculator.ts`
- `server/services/foundersOfficeCalculator.ts`
- `server/services/whiteLabelCalculator.ts`
