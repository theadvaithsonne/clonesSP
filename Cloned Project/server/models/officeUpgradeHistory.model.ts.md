# `server/models/officeUpgradeHistory.model.ts`

> Mongoose model `OfficeUpgradeHistory` (collection `officeupgradehistories`) with 13 top-level fields.

**Kind:** Mongoose model · **Lines:** 133

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `OfficeUpgradeHistory`

- **Collection:** `officeupgradehistories` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `founderId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `previousSubscriptionId` | `Schema.Types.ObjectId` | required, ref "OfficeSubscription" |
| `previousRazorpaySubscriptionId` | `String` | required |
| `previousPlanSlug` | `String` | required |
| `newSubscriptionId` | `Schema.Types.ObjectId` | required, ref "OfficeSubscription" |
| `newRazorpaySubscriptionId` | `String` | required |
| `newPlanSlug` | `String` | required |
| `creditCalculation` | `CreditCalculationSchema` | required |
| `walletTransactionId` | `Schema.Types.ObjectId` | required, ref "StoreWallet" |
| `status` | `String` | index, default "completed", enum ["completed", "failed"] |
| `completedAt` | `Date` | required |
| `errorMessage` | `String` | — |

### Indexes

- `{ orgId: 1, status: 1 }` (L126)
- `{ createdAt: -1 }` (L127)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeUpgradeStatus` | type |  | 3 |
| `ICreditCalculation` | interface |  | 7 |
| `IOfficeUpgradeHistory` | interface |  | 16 |
| `OfficeUpgradeHistory` | model | `mongoose.model<IOfficeUpgradeHistory>( "OfficeUpgradeHistory", OfficeUpgradeHistorySchema…` | 129 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/officeSubscriptionAdmin.ts`
- `server/services/officeSubscription.ts`
