# `server/models/officeAddonPayment.model.ts`

> Mongoose model `OfficeAddonPayment` (collection `officeaddonpayments`) with 23 top-level fields.

**Kind:** Mongoose model · **Lines:** 163

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `OfficeAddonPayment`

- **Collection:** `officeaddonpayments` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `subscriptionId` | `Schema.Types.ObjectId` | required, index, ref "OfficeAddonSubscription" |
| `addonId` | `Schema.Types.ObjectId` | required, index, ref "OfficeAddon" |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `founderId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `razorpayPaymentId` | `String` | required, unique, index |
| `razorpaySubscriptionId` | `String` | required, index |
| `razorpayOrderId` | `String` | index |
| `razorpayInvoiceId` | `String` | index |
| `invoiceShortUrl` | `String` | — |
| `amount` | `Number` | required |
| `currency` | `String` | default "INR" |
| `status` | `String` | index, default "created", enum ["created", "authorized", "captured", "refu… |
| `paymentNumber` | `Number` | required |
| `method` | `String` | — |
| `cardId` | `String` | — |
| `bank` | `String` | — |
| `wallet` | `String` | — |
| `vpa` | `String` | — |
| `fee` | `Number` | — |
| `tax` | `Number` | — |
| `paidAt` | `Date` | — |
| `commissionDistributed` | `Boolean` | default false |
| `commissionDistributionId` | `Schema.Types.ObjectId` | ref "WalletTransaction" |

### Indexes

- `{ razorpaySubscriptionId: 1, paymentNumber: 1 }, { unique: true }` (L145)
- `{ subscriptionId: 1, createdAt: -1 }` (L151)
- `{ orgId: 1, createdAt: -1 }` (L154)
- `{ commissionDistributed: 1, status: 1 }` (L157)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficeAddonPaymentStatus` | type |  | 3 |
| `IOfficeAddonPayment` | interface |  | 10 |
| `OfficeAddonPayment` | model | `mongoose.model<IOfficeAddonPayment>( "OfficeAddonPayment", OfficeAddonPaymentSchema )` | 159 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/services/officeAddonSubscription.ts`
