# `server/services/founderProductCalculator.ts`

> src/services/founderProductCalculator.ts

**Kind:** backend service · **Lines:** 529

<!-- docgen:auto -->

## Purpose
src/services/founderProductCalculator.ts

Pure earnings model for FOUNDER-SET commission on store items (courses,
products, channels, workshops, services, calls, events). No DB writes, no
side effects — a plan shape plus a hypothetical sales shape in, what that
would pay out with the reasoning attached.

It mirrors services/commission.ts rather than inventing a second set of
rules. A founder chooses ONE of two engines per item (CombPlanKind):

  "levels"        — fixed L1/L2/L3… percentages of the sale principal, paid
                    to the buyer's referral chain. L1 is the buyer's direct
                    referrer. Every active plan in production is this kind.
  "unilevel_plus" — a single percentage of the principal is handed to the
                    Unilevel Plus tree and split by ITS rules (36% direct,
                    28.8% levels, 4.8%/24% infinity, 4% company, 2.4% […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `COMB_PLAN_MAX_PERCENTAGE` | const | `= 90` — Same ceiling commission.ts enforces on a plan's level percentages. | 46 |
| `UP_MAX_LEVELS` | const | `= 15` — The Unilevel Plus engine's own depth; sales below this pay nothing. | 48 |
| `FounderPlanKind` | type |  | 50 |
| `FounderCalculatorInput` | interface |  | 52 |
| `FounderLevelRow` | interface |  | 78 |
| `FounderCalculatorResult` | interface |  | 88 |
| `calculateFounderProductEarnings` | function | `calculateFounderProductEarnings(input: FounderCalculatorInput, plan?: IUnilevelPlusPlan \| null): FounderCalculatorResult` — Entry point. `plan` is only needed for the "unilevel_plus" kind; the "levels" kind is fully described by the founder's own percentages. | 513 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/unilevelPlusPlan.model.ts` — `IUnilevelPlusPlan`
  - `server/services/unilevelPlusCalculator.ts` — `averageLegMultiplier`, `CALC_T1_PER_RECIPIENT`, `CALC_T2_PER_RECIPIENT`, `CALC_MAX_RECIPIENTS_PER_TIER`, `CALC_T1_MIN_LEGS`, `CALC_T2_MIN_LEGS`
- **Packages:** none

## Used by

- `server/routes/publicFounderProduct.ts`
- `server/services/__tests__/founderProductCalculator.test.ts`
