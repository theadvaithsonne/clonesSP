# `server/services/rankBonusCalculator.ts`

> src/services/rankBonusCalculator.ts

**Kind:** backend service · **Lines:** 246

<!-- docgen:auto -->

## Purpose
src/services/rankBonusCalculator.ts

Pure earnings model for the NetworkChain monthly rank bonus. No DB writes.

It mirrors services/rankBonus/qualify.ts rather than restating the rules in
a second dialect. The three that matter:

  1. Bronze gates EVERYTHING. Inactive yourself, or fewer than the required
     active directs, and you hold no rank at all no matter how strong your
     downline is.
  2. Above Bronze the test is LEGS, not headcount: `requiredLegs` separate
     legs must each contain at least one holder of the rank directly below.
     Two Silvers in one leg count once.
  3. A higher rank satisfies a lower-rank leg requirement — a Gold sitting
     in a leg also makes it a "Silver leg". That's why the ladder rewards
     outranking rather than punishing it. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RankCalculatorInput` | interface |  | 27 |
| `LadderRow` | interface |  | 48 |
| `RankCalculatorResult` | interface |  | 58 |
| `calculateRankBonus` | function | `calculateRankBonus(plan: IRankPlan, input: RankCalculatorInput, sponsorBonusDefault = 6): RankCalculatorResult` | 108 |

## Interfaces

- **Database (Mongoose models used):**
  - `RANK_KEYS` (server/models/rankPlan.model.ts) — referenced

## Dependencies

- **Internal:**
  - `server/models/rankPlan.model.ts` — `IRankPlan`, `RANK_KEYS`, `RankKey`, `payoutFor`
- **Packages:** none

## Used by

- `server/routes/publicRankBonus.ts`
