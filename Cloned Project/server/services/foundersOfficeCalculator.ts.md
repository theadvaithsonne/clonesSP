# `server/services/foundersOfficeCalculator.ts`

> src/services/foundersOfficeCalculator.ts

**Kind:** backend service · **Lines:** 344

<!-- docgen:auto -->

## Purpose
src/services/foundersOfficeCalculator.ts

Pure earnings model for referring Founders Office ($96/month) subscriptions.
No DB writes, no side effects — a hypothetical downline of subscribers in,
what it pays out with the reasoning attached.

It mirrors services/officeSubscription.ts (Pro branch) and
config/founderSubBonus.ts rather than inventing rules. Every $96 payment —
the activation AND every monthly renewal — is split three ways:

  $25  → the Unilevel Plus tree, as exactly one licence unit. So the
         founder's referral chain earns what it would on a $25 licence
         sale: $9 direct, level bonus by leg multiplier × level × $0.02,
         $0.40 / $2.00 infinity per qualifying upline.
  $24  → flat, to the founder's DIRECT referrer.
  $47  → the platform. The monthly volume bonus below is carved from it. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FOUNDERS_OFFICE_PRICE_USD` | const | `= 96` — Mirrors the constants in officeSubscription.ts' Pro branch. | 41 |
| `FOUNDERS_OFFICE_DIRECT_FLAT_USD` | const | `= 24` | 42 |
| `FoundersOfficeInput` | interface |  | 44 |
| `FoundersOfficeLevelRow` | interface |  | 63 |
| `FoundersOfficeResult` | interface |  | 71 |
| `calculateFoundersOfficeEarnings` | function | `calculateFoundersOfficeEarnings(plan: IUnilevelPlusPlan, input: FoundersOfficeInput): FoundersOfficeResult` | 119 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/unilevelPlusPlan.model.ts` — `IUnilevelPlusPlan`
  - `server/config/founderSubBonus.ts` — `FOUNDER_SUB_BONUS`, `computeFounderSubBonusUsd`
  - `server/services/unilevelPlusCalculator.ts` — `averageLegMultiplier`, `CALC_T1_PER_RECIPIENT`, `CALC_T2_PER_RECIPIENT`, `CALC_MAX_RECIPIENTS_PER_TIER`, `CALC_T1_MIN_LEGS`, `CALC_T2_MIN_LEGS`
- **Packages:** none

## Used by

- `server/routes/publicFoundersOffice.ts`
- `server/services/__tests__/foundersOfficeCalculator.test.ts`
