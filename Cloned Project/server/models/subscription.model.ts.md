# `server/models/subscription.model.ts`

> Mongoose model for a user's recurring Razorpay subscription to a channel, course, workshop or product, mirroring Razorpay's subscription lifecycle.

**Kind:** Mongoose model · **Lines:** 186

## Purpose
Sellers can offer recurring access to their content through `SubscriptionPlan`s. When a buyer subscribes, a Razorpay subscription is created and recorded here. This row is what access checks (`requireActiveSubscription`), "my subscriptions" listings, seller analytics and the unified orders view read. Each billing cycle's payment is recorded separately in `SubscriptionPayment`.

## How it works
### Status lifecycle
`status` uses Razorpay's subscription states plus `expired`: `created` (default) -> `authenticated` -> `active`, with `pending`, `halted`, `paused`, `cancelled`, `completed`, `expired`. The status is indexed.

### Fields
- **Razorpay identity:** `razorpaySubscriptionId` (required, unique), `razorpayPlanId` (required), `razorpayCustomerId` (indexed), `shortUrl` (Razorpay hosted authorisation page), `offerId`.
- **Ownership:** `planId` -> `SubscriptionPlan` (required); `userId` -> `User` (subscriber); `orgId` -> `Organization`; `sellerId` -> `User` (content creator, used for commission distribution). All are required, and all except `planId` are indexed.
- **Item:** `itemType` (enum `channel | course | workshop | product`, typed via `SubscriptionItemType` from the plan model) and `itemId` with `refPath: "itemType"`.
- **Billing window:** `currentStart`, `currentEnd` (indexed), `chargeAt` (next charge, indexed), `startedAt`, `endedAt`, `cancelledAt`, `pausedAt`.
- **Counters:** `totalCount` (undefined means unlimited cycles), `paidCount` (default 0), `remainingCount`.
- `paymentMethod`: enum `card | upi | emandate | nach | wallet`.
- `metadata`: Mixed.
- `timestamps: true`.

### Indexes
`{ userId, itemType, itemId }` (a user's subscription to an item); `{ userId, status }`; `{ currentEnd, status }` (expiring soon); `{ chargeAt, status }` (monitoring); `{ sellerId, status, createdAt: -1 }` and `{ orgId, status, createdAt: -1 }` (analytics).

## Exports
- `Subscription` - Mongoose model `"Subscription"` (collection `subscriptions`).
- `ISubscription` - document interface.
- `SubscriptionStatus` - union of the nine statuses.
- `PaymentMethod` - `"card" | "upi" | "emandate" | "nach" | "wallet"`.

## Interfaces
- **Database:** `Subscription` (collection `subscriptions`), read and written.
- **External services:** values mirror Razorpay Subscriptions API objects. Webhooks and sync handlers in the subscription service update them.

## Dependencies
- **Internal:** `server/models/subscriptionPlan.model.ts` - `SubscriptionItemType` type only.
- **Packages:** `mongoose`.

## Used by
`server/middleware/subscriptionAccess.ts`, `server/routes/feed.ts`, `server/routes/subscriptionAdmin.ts`, `server/routes/subscriptions.ts` (mounted at `/subscriptions`, browser `/backend/subscriptions/...`), `server/routes/unifiedOrders.ts`, `server/services/subscription.ts`.

## Notes
- `refPath: "itemType"` resolves to model names `channel`, `course`, `workshop` and `product`. These are lower-case and may not match registered model names, so `populate("itemId")` may not work as it stands.
