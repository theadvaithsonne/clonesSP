# `server/models/combPlan.model.ts`

> Mongoose model `CombPlan` (collection `combplans`) with 14 top-level fields.

**Kind:** Mongoose model · **Lines:** 318

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `CombPlan`

- **Collection:** `combplans` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `name` | `String` | required, trim |
| `description` | `String` | trim |
| `itemType` | `String` | required, index, enum ["course", "product", "channel", "workshop"… |
| `itemId` | `Schema.Types.ObjectId` | required, index |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `createdBy` | `Schema.Types.ObjectId` | required, ref "User" |
| `levels` | `[CombPlanLevelSchema]` | required |
| `totalPercentage` | `Number` | required, default 0 |
| `platformPercentage` | `Number` | required, default 5 |
| `isActive` | `Boolean` | index, default true |
| `planKind` | `String` | index, default "levels", enum ["levels", "unilevel_plus"] |
| `unilevelPlusPercentage` | `Number` | — |
| `capType` | `String` | default "perpetual", enum ["perpetual", "per_pair_capped"] |
| `capCount` | `Number` | — |

### Indexes

- `{ itemType: 1, itemId: 1, isActive: 1 }, { unique: true, partialFilterExpression: { isActive: true }, }` (L223)
- `{ orgId: 1, itemType: 1, isActive: 1 }` (L232)

**Schema hooks / virtuals:** `pre("save")`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ICombPlanLevel` | interface |  | 3 |
| `CombPlanCapType` | type | How the plan caps commission distributions: - "perpetual" — every purchase pays commission every time (the historical behaviour, and the DEFAULT for every plan created before this field existed). | 20 |
| `CombPlanKind` | type | Which comp engine this plan drives. | 36 |
| `ICombPlan` | interface |  | 38 |
| `CombPlan` | model | `model<ICombPlan>("CombPlan", CombPlanSchema)` | 317 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/routes/affiliate.ts`
- `server/routes/bond.ts`
- `server/routes/internal-catalog.ts`
- `server/routes/public.ts`
- `server/services/affiliateTransactionDetail.ts`
- `server/services/bondCommission.ts`
- `server/services/cashbackCode.ts`
- `server/services/commission.ts`
- `server/services/downlineMemberLiveStreams.ts`
- `server/services/downlineMemberPurchases.ts`
- `server/services/founderStreamTable.ts`
- `server/services/workshop.ts`
