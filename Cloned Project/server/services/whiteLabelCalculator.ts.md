# `server/services/whiteLabelCalculator.ts`

> src/services/whiteLabelCalculator.ts

**Kind:** backend service · **Lines:** 276

<!-- docgen:auto -->

## Purpose
src/services/whiteLabelCalculator.ts

Pure earnings model for referring White Label licences ($600/year). No DB
writes, no side effects.

Mirrors config/whitelabelAddon.ts and services/whitelabelAddonPurchase.ts
(chargeReferralCommission), which runs on the activation invoice AND on
every yearly renewal invoice. Each $600 payment pays $300 of commission:

  $150  flat, to the buyer's DIRECT referrer.
  $150  run through the Unilevel Plus tree as SIX separate $25 licence
        units — so the chain earns six times what one licence pays:
        6 × $9 direct, 6 × the level bonus, 6 × $0.40 / $2.00 infinity.
  $6    platform residual.

On top, once a calendar month, the direct referrer earns a volume bonus: […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WHITE_LABEL_UP_UNITS` | const | `= 6` — Mirrors the loop in chargeReferralCommission. | 35 |
| `WhiteLabelInput` | interface |  | 37 |
| `WhiteLabelLevelRow` | interface |  | 52 |
| `WhiteLabelResult` | interface |  | 60 |
| `calculateWhiteLabelEarnings` | function | `calculateWhiteLabelEarnings(plan: IUnilevelPlusPlan, input: WhiteLabelInput): WhiteLabelResult` | 103 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/models/unilevelPlusPlan.model.ts` — `IUnilevelPlusPlan`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
  - `server/services/unilevelPlusCalculator.ts` — `averageLegMultiplier`, `CALC_T1_PER_RECIPIENT`, `CALC_T2_PER_RECIPIENT`, `CALC_MAX_RECIPIENTS_PER_TIER`, `CALC_T1_MIN_LEGS`, `CALC_T2_MIN_LEGS`
- **Packages:** none

## Used by

- `server/routes/publicWhiteLabel.ts`
- `server/services/__tests__/whiteLabelCalculator.test.ts`
