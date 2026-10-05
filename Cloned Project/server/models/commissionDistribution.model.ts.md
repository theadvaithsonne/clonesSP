# `server/models/commissionDistribution.model.ts`

> Mongoose model `CommissionDistribution` (collection `commissiondistributions`) with 21 top-level fields.

**Kind:** Mongoose model · **Lines:** 211

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `CommissionDistribution`

- **Collection:** `commissiondistributions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `combPlanId` | `Schema.Types.ObjectId` | index, ref "CombPlan" |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `sellerId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `customerId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `itemType` | `String` | required, index, enum ["course", "product", "channel", "workshop"… |
| `itemId` | `Schema.Types.ObjectId` | required, index |
| `itemName` | `String` | required, trim |
| `saleAmount` | `Number` | required |
| `currency` | `String` | default "USD" |
| `platformFeePercentage` | `Number` | required, default 5 |
| `platformFeeAmount` | `Number` | required |
| `netAmount` | `Number` | required |
| `sellerAmount` | `Number` | required |
| `commissions` | `[CommissionRecipientSchema]` | default [] |
| `totalCommissionAmount` | `Number` | required, default 0 |
| `paymentId` | `String` | index |
| `status` | `String` | index, default "pending", enum ["pending", "completed", "failed", "reverse… |
| `failureReason` | `String` | trim |
| `isRecurringPayment` | `Boolean` | default false |
| `recurringPaymentNumber` | `Number` | — |
| `metadata` | `Schema.Types.Mixed` | — |

### Indexes

- `{ sellerId: 1, status: 1, createdAt: -1 }` (L194)
- `{ customerId: 1, createdAt: -1 }` (L195)
- `{ orgId: 1, itemType: 1, createdAt: -1 }` (L196)
- `{ "commissions.userId": 1, createdAt: -1 }` (L197)
- `{ itemType: 1, itemId: 1, createdAt: -1 }` (L198)
- `{ paymentId: 1, itemType: 1, itemId: 1 }, { unique: true, sparse: true }` (L202)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ICommissionRecipient` | interface |  | 3 |
| `ICommissionDistribution` | interface |  | 17 |
| `CommissionDistribution` | model | `model<ICommissionDistribution>( "CommissionDistribution", CommissionDistributionSchema )` | 207 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/affiliate.ts`
- `server/routes/franchiseApi.ts`
- `server/routes/franchiseEntity.ts`
- `server/routes/garageAdminAuctionSettlements.ts`
- `server/scripts/audit-partial-fanout.ts`
- `server/scripts/diagnoseAuctionSettlement.ts`
- `server/scripts/find-coupon-ecommerce-overcredits.ts`
- `server/scripts/reset-wallets.ts`
- `server/services/affiliateAnalytics.ts`
- `server/services/affiliateTransactionDetail.ts`
- `server/services/auctionSettlement.ts`
- `server/services/cashbackCode.ts`
- `server/services/commission.ts`
- `server/services/downlineMemberLiveStreams.ts`
- `server/services/downlineMemberMonthly.ts`
- `server/services/downlineMemberPurchases.ts`
- `server/services/founderStreamTable.ts`
- `server/services/genealogy/data.ts`
- `server/services/workshop.ts`
