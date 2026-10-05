# `server/models/invoice.model.ts`

> Mongoose model `Invoice` (collection `invoices`) with 57 top-level fields.

**Kind:** Mongoose model · **Lines:** 845

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `Invoice`

- **Collection:** `invoices` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `invoiceNumber` | `String` | unique, default function () { const timesta… |
| `invoiceType` | `String` | required, enum ["one_time", "recurring"] |
| `status` | `String` | index, default "draft", enum ["draft", "pending", "paid", "failed", "can… |
| `organizationId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `sellerId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `customerEmail` | `String` | required |
| `customerName` | `String` | — |
| `lineItems` | `[InvoiceLineItemSchema]` | required |
| `subtotal` | `Number` | required |
| `discount` | `Number` | default 0 |
| `tax` | `Number` | default 0 |
| `shippingCost` | `Number` | default 0 |
| `totalAmount` | `Number` | required |
| `itemCurrency` | `String` | required, enum ["USD", "INR"] |
| `paymentCurrency` | `String` | enum [...SUPPORTED_FIAT_CURRENCIES] |
| `currencyConversion` | `CurrencyConversionSchema` | — |
| `paymentMethodCategory` | `String` | enum ["card", "upi", "crypto", "wallet"] |
| `paymentPlatform` | `String` | enum ["razorpay", "stripe", "openmoney", "square… |
| `paymentSource` | `String` | default "web", enum ["web", "ios", "android"] |
| `razorpayOrderId` | `String` | — |
| `razorpayPaymentId` | `String` | — |
| `razorpaySubscriptionId` | `String` | — |
| `razorpayInvoiceId` | `String` | — |
| `invoiceShortUrl` | `String` | — |
| `paidAt` | `Date` | — |
| `failedAt` | `Date` | — |
| `cancelledAt` | `Date` | — |
| `refundedAt` | `Date` | — |
| `expiresAt` | `Date` | — |
| `isRecurring` | `Boolean` | default false |
| `recurringPeriod` | `String` | enum ["weekly", "monthly", "quarterly", "yearly"] |
| `recurringIntervalMonths` | `Number` | — |
| `recurringPaymentNumber` | `Number` | — |
| `parentInvoiceId` | `Schema.Types.ObjectId` | ref "Invoice" |
| `subscriptionRef` | `Schema.Types.ObjectId` | ref "Subscription" |
| `nextDueDate` | `Date` | — |
| `couponId` | `Schema.Types.ObjectId` | ref "Coupon" |
| `couponCode` | `String` | — |
| `couponUsageId` | `Schema.Types.ObjectId` | ref "CouponUsage" |
| `cashbackCodeId` | `Schema.Types.ObjectId` | index, ref "CashbackCode" |
| `shippingAddress` | `ShippingAddressSchema` | — |
| `billingAddress` | `ShippingAddressSchema` | — |
| `paymentMode` | `String` | enum ["Prepaid", "COD"] |
| `gstin` | `String` | trim |
| `companyName` | `String` | trim |
| `customerNote` | `String` | trim |
| `referralId` | `String` | — |
| `metadata` | `Schema.Types.Mixed` | — |
| `notes` | `String` | — |
| `commissionDistributed` | `Boolean` | default false |
| `commissionDistributionId` | `Schema.Types.ObjectId` | ref "CommissionDistribution" |
| `errorCode` | `String` | — |
| `errorDescription` | `String` | — |
| `thirdPartyClientId` | `Schema.Types.ObjectId` | ref "ThirdPartyClient" |
| `thirdPartyExternalId` | `String` | — |
| `webhookDelivery` | `{ attempts, lastAttemptAt, lastStatus, deliveredAt }` | nested |

### Indexes

- `{ userId: 1, createdAt: -1 }` (L807)
- `{ organizationId: 1, status: 1, createdAt: -1 }` (L810)
- `{ sellerId: 1, status: 1, createdAt: -1 }` (L813)
- `{ razorpayOrderId: 1 }, { unique: true, sparse: true }` (L816)
- `{ razorpayPaymentId: 1 }, { unique: true, sparse: true }` (L819)
- `{ parentInvoiceId: 1 }` (L822)
- `{ razorpaySubscriptionId: 1, recurringPaymentNumber: 1 }` (L823)
- `{ status: 1, expiresAt: 1 }` (L826)
- `{ status: 1, commissionDistributed: 1 }` (L829)
- `{ isRecurring: 1, status: 1, nextDueDate: 1 }` (L832)
- `{ status: 1, "lineItems.itemType": 1, paidAt: -1 }` (L835)
- `{ thirdPartyClientId: 1, createdAt: -1 }` (L838)
- `{ thirdPartyClientId: 1, thirdPartyExternalId: 1 }, { unique: true, sparse: true }` (L839)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InvoiceType` | type |  | 6 |
| `InvoiceStatus` | type |  | 8 |
| `InvoiceItemType` | type |  | 17 |
| `couponProductTypeForItem` | function | `couponProductTypeForItem(itemType: InvoiceItemType): \| "product" \| "course" \| "channel" \| "service" \| …` — Map an invoice line item's itemType to the corresponding platform-coupon productType. | 119 |
| `PaymentMethodCategory` | type |  | 193 |
| `PaymentPlatform` | type |  | 195 |
| `IInvoiceLineItem` | interface |  | 211 |
| `ICurrencyConversion` | interface |  | 251 |
| `IShippingAddress` | interface |  | 258 |
| `IInvoice` | interface |  | 271 |
| `Invoice` | model | `mongoose.model<IInvoice>("Invoice", InvoiceSchema)` | 844 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/utils/exchangeRate.ts` — `SUPPORTED_FIAT_CURRENCIES`
- **Packages:**
  - `mongoose` — `Schema`, `Document`, `Types`

## Used by

- `scripts/mint-synthetic-combo.ts`
- `server/bat246/controllers/bat246.controller.ts`
- `server/bat246/routes/bat246.routes.ts`
- `server/bat246/services/bat246.service.ts`
- `server/bat246/services/bat246PodInvite.service.ts`
- `server/controllers/garageAdmin.controller.ts`
- `server/index.ts`
- `server/realtime/mediasoupHandlers.ts`
- `server/routes/bond.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/franchiseApi.ts`
- `server/routes/franchiseEntity.ts`
- `server/routes/franchiseGlobal.ts`
- `server/routes/franchiseProgram.ts`
- `server/routes/garageAdminDailyReports.ts`
- `server/routes/garageAdminNetworkChainSubs.ts`
- `server/routes/garageAdminOneTimeAffiliates.ts`
- `server/routes/garageAdminSavedCards.ts`
- `server/routes/garageAdminSupport.ts`
- `server/routes/genealogy.ts`
- `server/routes/hifiInvoice.ts`
- `server/routes/internalCrypto.ts`
- _…and 94 more_
