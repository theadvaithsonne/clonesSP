# `server/models/officeSubscriptionPayment.model.ts`

> Mongoose model `OfficeSubscriptionPayment` (collection `officesubscriptionpayments`) with 23 top-level fields.

**Kind:** Mongoose model · **Lines:** 154

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `OfficeSubscriptionPayment`

- **Collection:** `officesubscriptionpayments` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `subscriptionId` | `Schema.Types.ObjectId` | required, index, ref "OfficeSubscription" |
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `founderId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `razorpayPaymentId` | `String` | required, unique, index |
| `razorpaySubscriptionId` | `String` | required, index |
| `razorpayOrderId` | `String` | — |
| `razorpayInvoiceId` | `String` | — |
| `invoiceShortUrl` | `String` | — |
| `amount` | `Number` | required |
| `currency` | `String` | default "INR" |
| `status` | `String` | default "created", enum ["created", "authorized", "captured", "refu… |
| `paymentNumber` | `Number` | required |
| `method` | `String` | — |
| `cardId` | `String` | — |
| `bank` | `String` | — |
| `wallet` | `String` | — |
| `vpa` | `String` | — |
| `fee` | `Number` | — |
| `tax` | `Number` | — |
| `notes` | `Schema.Types.Mixed` | — |
| `commissionDistributed` | `Boolean` | default false |
| `commissionDistributionId` | `Schema.Types.ObjectId` | ref "CommissionDistribution" |
| `paidAt` | `Date` | required |

### Indexes

- `{ subscriptionId: 1, paymentNumber: 1 }, { unique: true }` (L139)
- `{ status: 1, createdAt: -1 }` (L145)
- `{ commissionDistributed: 1, status: 1 }` (L148)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficePaymentStatus` | type |  | 3 |
| `IOfficeSubscriptionPayment` | interface |  | 10 |
| `OfficeSubscriptionPayment` | model | `mongoose.model<IOfficeSubscriptionPayment>( "OfficeSubscriptionPayment", OfficeSubscripti…` | 150 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `server/routes/officeSubscriptionAdmin.ts`
- `server/services/officeSubscription.ts`
