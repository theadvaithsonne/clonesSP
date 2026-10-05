# `server/models/subscriptionPayment.model.ts`

> Mongoose model for one Razorpay payment (one billing cycle) on a recurring `Subscription`, including payment-method details, failure details and commission-distribution status.

**Kind:** Mongoose model · **Lines:** 193

## Purpose
Each charge Razorpay makes against a subscription is recorded as a `SubscriptionPayment`. These rows give the buyer a payment history, give the seller and admins revenue data, and give commission distribution an idempotency flag: each captured payment should pay commission once, recorded by `commissionDistributed` / `commissionDistributionId`.

## How it works
### Fields
- **Links:** `subscriptionId` -> `Subscription` (required, indexed); `userId`, `sellerId` -> `User`; `orgId` -> `Organization` (all required and indexed).
- **Razorpay identity:** `razorpayPaymentId` (required, **unique**), `razorpaySubscriptionId` (required, indexed), `razorpayOrderId`, `razorpayInvoiceId`, `invoiceShortUrl` (public invoice URL).
- **Money:** `amount` in **paise** (required, min 0); `currency` (default `"INR"`); `fee` and `tax` (Razorpay fee and the tax on it, in paise).
- **Status:** `status` enum `created | authorized | captured | failed | refunded`, default `created`, indexed.
- `paymentNumber`: billing cycle number (required, min 1).
- **Method details:** `method`, `cardId`, `bank`, `wallet`, `vpa` (UPI ID).
- **Failure details:** `errorCode`, `errorDescription`, `errorSource`, `errorStep`, `errorReason`.
- `notes`: Mixed (Razorpay notes).
- **Commission:** `commissionDistributed` (default false); `commissionDistributionId` -> `CommissionDistribution`.
- `paidAt`, `refundedAt`; `timestamps: true`.

### Indexes
`{ subscriptionId, paymentNumber }`; `{ userId, status, createdAt: -1 }`; `{ sellerId, status, createdAt: -1 }`; `{ orgId, status, createdAt: -1 }`; `{ status, commissionDistributed }` (finds captured payments still waiting for commission).

## Exports
- `SubscriptionPayment` - Mongoose model `"SubscriptionPayment"` (collection `subscriptionpayments`).
- `ISubscriptionPayment` - document interface.
- `SubscriptionPaymentStatus` - union of the five statuses.

## Interfaces
- **Database:** `SubscriptionPayment` (collection `subscriptionpayments`), read and written.
- **External services:** fields mirror Razorpay payment and invoice objects.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/officeSubscriptionAdmin.ts`, `server/routes/subscriptionAdmin.ts`, `server/routes/subscriptions.ts` (for example `GET /backend/subscriptions/:subscriptionId/payments`), `server/routes/unifiedOrders.ts`, `server/services/subscription.ts`. The service checks for an existing row by payment before it creates one, creates rows with `commissionDistributed: false`, and later sets the flag to true once commission is distributed.

## Notes
- Amounts are in the smallest unit (paise), unlike `StoreProduct.price`, which is in main units.
- The unique `razorpayPaymentId` makes repeated webhooks idempotent at the database level.
