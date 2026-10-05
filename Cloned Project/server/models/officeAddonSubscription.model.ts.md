# `server/models/officeAddonSubscription.model.ts`

> Mongoose model `OfficeAddonSubscription` (collection `officeaddonsubscriptions`) with 21 top-level fields.

**Kind:** Mongoose model · **Lines:** 167

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `OfficeAddonSubscription`

- **Collection:** `officeaddonsubscriptions` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `founderId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `addonId` | `Schema.Types.ObjectId` | required, index, ref "OfficeAddon" |
| `razorpaySubscriptionId` | `String` | unique, index, sparse |
| `razorpayPlanId` | `String` | — |
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

### Indexes

- `{ orgId: 1, addonId: 1 }, { unique: true }` (L152)
- `{ orgId: 1, status: 1 }` (L155)
- `{ currentEnd: 1, status: 1 }` (L158)
- `{ founderId: 1, status: 1 }` (L161)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeAddonSubscriptionStatus` | type |  | 3 |
| `OfficeAddonPaymentMethod` | type |  | 14 |
| `IOfficeAddonSubscription` | interface |  | 16 |
| `OfficeAddonSubscription` | model | `mongoose.model<IOfficeAddonSubscription>( "OfficeAddonSubscription", OfficeAddonSubscript…` | 163 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/officeAddonCheckout.ts`
- `server/scripts/activate-whitelabel-manual.ts`
- `server/scripts/audit-whitelabel-state.ts`
- `server/scripts/deactivate-whitelabel-manual.ts`
- `server/scripts/delete-yopmail-users.ts`
- `server/scripts/diagnose-whitelabel-commission.ts`
- `server/scripts/latest-whitelabel-purchase.ts`
- `server/scripts/migrate-office-addon-sub-razorpay-index.ts`
- `server/scripts/revert-whitelabel-invoice.ts`
- `server/services/cryptosubAddonPurchase.ts`
- `server/services/officeAddonSubscription.ts`
- `server/services/whitelabelAddonPurchase.ts`
