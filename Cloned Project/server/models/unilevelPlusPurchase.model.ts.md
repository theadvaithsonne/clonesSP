# `server/models/unilevelPlusPurchase.model.ts`

> Mongoose model `UnilevelPlusPurchase` (collection `unilevelpluspurchases`) with 8 top-level fields.

**Kind:** Mongoose model · **Lines:** 96

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `UnilevelPlusPurchase`

- **Collection:** `unilevelpluspurchases` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, unique, ref "User" |
| `planId` | `Schema.Types.ObjectId` | required, ref "UnilevelPlusPlan" |
| `paymentId` | `String` | required, unique |
| `amount` | `Number` | required |
| `currency` | `String` | default "USD" |
| `status` | `String` | index, default "active", enum ["active", "expired", "refunded"] |
| `purchasedAt` | `Date` | default Date.now |
| `metadata` | `Schema.Types.Mixed` | — |

### Indexes

- `{ userId: 1, status: 1 }` (L62)
- `{ planId: 1, createdAt: -1 }` (L63)

**Schema hooks / virtuals:** `pre("save")`, `post("save")`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IUnilevelPlusPurchase` | interface |  | 3 |
| `UnilevelPlusPurchase` | model | `model<IUnilevelPlusPurchase>( "UnilevelPlusPurchase", UnilevelPlusPurchaseSchema )` | 92 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `scripts/mint-synthetic-combo.ts`
- `server/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts`
- `server/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts`
- `server/controllers/garageAdmin.controller.ts`
- `server/routes/affiliate.ts`
- `server/routes/downlineTable.ts`
- `server/routes/franchiseApi.ts`
- `server/routes/garageAdminOneTimeAffiliates.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/unilevel-plus.ts`
- `server/routes/wallet.ts`
- `server/routes/webhook.ts`
- `server/scripts/backfill-assignee-type-flags.ts`
- `server/scripts/backfill-combo-free-month.ts`
- `server/scripts/migrate-sweep-locked-earnings.ts`
- `server/scripts/setup-test-account.ts`
- `server/services/affiliateAnalytics.ts`
- `server/services/affiliateTransactionDetail.ts`
- `server/services/downlineTypeFlags.ts`
- `server/services/genealogy/data.ts`
- `server/services/invoice.ts`
- `server/services/networkChainCoverage.ts`
- `server/services/reserveLicense.ts`
- `server/services/unilevelPlusCommission.ts`
- `server/services/wallet.ts`
