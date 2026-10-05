# `server/models/officeSubscription.model.ts`

> Mongoose model `OfficeSubscription` (collection `officesubscriptions`) with 26 top-level fields.

**Kind:** Mongoose model · **Lines:** 187

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `OfficeSubscription`

- **Collection:** `officesubscriptions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, unique, index, ref "Organization" |
| `founderId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `planId` | `Schema.Types.ObjectId` | required, ref "OfficePlan" |
| `razorpaySubscriptionId` | `String` | unique, index, sparse |
| `razorpayPlanId` | `String` | required |
| `razorpayCustomerId` | `String` | index |
| `status` | `String` | index, default "created", enum [ "created", "authenticated", "active", "pe… |
| `currentStart` | `Date` | — |
| `currentEnd` | `Date` | index |
| `chargeAt` | `Date` | index |
| `startedAt` | `Date` | — |
| `endedAt` | `Date` | — |
| `cancelledAt` | `Date` | — |
| `pausedAt` | `Date` | — |
| `totalCount` | `Number` | — |
| `paidCount` | `Number` | default 0 |
| `remainingCount` | `Number` | — |
| `shortUrl` | `String` | — |
| `paymentMethod` | `String` | enum ["card", "upi", "emandate", "nach", "wallet… |
| `offerId` | `String` | — |
| `metadata` | `Schema.Types.Mixed` | — |
| `isTrial` | `Boolean` | index, default false |
| `trialStartedAt` | `Date` | — |
| `trialEndsAt` | `Date` | index |
| `trialExpired` | `Boolean` | default false |
| `convertedFromTrial` | `Boolean` | default false |

### Indexes

- `{ orgId: 1, status: 1 }` (L175)
- `{ currentEnd: 1, status: 1 }` (L178)
- `{ founderId: 1, status: 1 }` (L181)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeSubscriptionStatus` | type |  | 3 |
| `OfficePaymentMethod` | type |  | 15 |
| `IOfficeSubscription` | interface |  | 17 |
| `OfficeSubscription` | model | `mongoose.model<IOfficeSubscription>( "OfficeSubscription", OfficeSubscriptionSchema )` | 183 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/affiliate.ts`
- `server/routes/auth.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/officeSubscriptionAdmin.ts`
- `server/scripts/delete-yopmail-users.ts`
- `server/scripts/repair-foundersoffice-activation.ts`
- `server/services/commission.ts`
- `server/services/downlineTypeFlags.ts`
- `server/services/founderSubMonthlyBonus/qualify.ts`
- `server/services/officePlanStatus.ts`
- `server/services/officeSubscription.ts`
- `server/utils/cabinetStorage.ts`
