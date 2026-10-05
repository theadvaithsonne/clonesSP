# `server/models/unilevelPlusPlan.model.ts`

> Mongoose model `UnilevelPlusPlan` (collection `unilevelplusplans`) with 20 top-level fields.

**Kind:** Mongoose model · **Lines:** 253

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `UnilevelPlusPlan`

- **Collection:** `unilevelplusplans` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `name` | `String` | required, trim |
| `description` | `String` | trim |
| `productPrice` | `Number` | required |
| `currency` | `String` | required, trim, default "USD" |
| `gstInclusive` | `Boolean` | default true |
| `companyPercentage` | `Number` | required |
| `directBonusPercentage` | `Number` | required |
| `levelBonusPercentage` | `Number` | required |
| `infinityTier1Percentage` | `Number` | required, default 0 |
| `infinityTier2Percentage` | `Number` | required, default 0 |
| `managerBonusPercentage` | `Number` | required, default 0 |
| `maxLevels` | `Number` | required, default 15 |
| `pointValue` | `Number` | required, default 0.03 |
| `legMultipliers` | `[Number]` | required, default [1, 2, 3] |
| `infinityTier1Enabled` | `Boolean` | default false |
| `infinityTier2Enabled` | `Boolean` | default false |
| `managerBonusEnabled` | `Boolean` | default false |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `createdBy` | `Schema.Types.ObjectId` | required, ref "User" |
| `isActive` | `Boolean` | index, default true |

### Indexes

- `{ isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true }, }` (L219)

**Schema hooks / virtuals:** `pre("save")`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IUnilevelPlusPlan` | interface |  | 3 |
| `UNILEVEL_PLUS_PLAN_ID` | const | `= "6963a0b0a3149ec5949aa940"` | 40 |
| `UNILEVEL_PLUS_PLAN_CONFIG` | const | `= { _id: UNILEVEL_PLUS_PLAN_ID, name: "Unilevel Plus", description: "Unlock multi-level a…` | 43 |
| `UnilevelPlusPlan` | model | `model<IUnilevelPlusPlan>( "UnilevelPlusPlan", UnilevelPlusPlanSchema )` | 249 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts`
- `server/routes/adminCouponRules.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/scripts/check-up-plan.ts`
- `server/scripts/retro-migrate-cascade-to-up.ts`
- `server/scripts/retro-up-single-to-six-units.ts`
- `server/scripts/setup-test-account.ts`
- `server/services/adminPlatformBilling.ts`
- `server/services/affiliateTransactionDetail.ts`
- `server/services/couponRule.ts`
- `server/services/cryptosubAddonPurchase.ts`
- `server/services/founderProductCalculator.ts`
- `server/services/foundersOfficeCalculator.ts`
- `server/services/unilevelPlusCalculator.ts`
- `server/services/unilevelPlusCommission.ts`
- `server/services/whiteLabelCalculator.ts`
- `server/services/whitelabelAddonPurchase.ts`
