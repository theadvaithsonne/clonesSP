# `server/models/storeCouponCommission.model.ts`

> Mongoose model `StoreCouponCommission` (collection `storecouponcommissions`) with 9 top-level fields.

**Kind:** Mongoose model · **Lines:** 174

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `StoreCouponCommission`

- **Collection:** `storecouponcommissions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `name` | `String` | required, trim |
| `triggerItemId` | `Schema.Types.ObjectId` | index, ref "StoreProduct" |
| `levels` | `[StoreCouponCommissionLevelSchema]` | required |
| `isActive` | `Boolean` | index, default true |
| `effectiveFrom` | `Date` | required, default () => new Date() |
| `capType` | `String` | default "perpetual", enum ["perpetual", "per_pair_capped"] |
| `capCount` | `Number` | — |
| `createdBy` | `Schema.Types.ObjectId` | required, ref "User" |

### Indexes

- `{ orgId: 1, isActive: 1 }` (L149)
- `{ triggerItemId: 1, isActive: 1 }` (L150)

**Schema hooks / virtuals:** `pre("save")`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MAX_STORE_COMMISSION_LEVELS` | const | `= 15` — StoreCouponCommission — cascading coupon rewards paid up the BUYER's upline chain when a `Storefront/StoreProduct` (invoice itemType `ecommerce_item`) is sold. | 30 |
| `StoreCouponCommissionCapType` | type | Same cap semantics as `CombPlanCapType` (see combPlan.model.ts) — mirrored so both commission systems speak the same language: - "perpetual" — every eligible store purchase fires the cascade for every level's recipient (historical behaviou… | 43 |
| `IStoreCouponCommissionLevel` | interface |  | 45 |
| `IStoreCouponCommission` | interface |  | 53 |
| `StoreCouponCommission` | model | `mongoose.model<IStoreCouponCommission>( "StoreCouponCommission", StoreCouponCommissionSch…` | 170 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/founderStoreCommissions.ts`
- `server/services/storeCouponCommission.ts`
