# `server/models/subscriptionPlan.model.ts`

> Mongoose model for a seller-defined recurring billing plan (backed by a Razorpay plan) on a channel, course, workshop or product.

**Kind:** Mongoose model · **Lines:** 110

## Purpose
Before anyone can subscribe to a piece of content, the seller creates a `SubscriptionPlan`. Each plan maps one-to-one to a Razorpay plan (`razorpayPlanId`) and defines price, period and trial. `Subscription` documents reference the plan they were created from. The file also exports the shared `SubscriptionItemType` and `SubscriptionPeriod` types.

## How it works
### Fields
| Field | Type | Notes |
|---|---|---|
| `razorpayPlanId` | String | required, unique |
| `itemType` | String | enum `channel \| course \| workshop \| product`, required |
| `itemId` | ObjectId | required, `refPath: "itemType"` |
| `orgId` | ObjectId -> `Organization` | required, indexed |
| `sellerId` | ObjectId -> `User` | required, indexed (content creator) |
| `name` | String | required |
| `description` | String | |
| `amount` | Number | required, **min 100** (comment: minimum 1 INR = 100 paise; smallest currency unit) |
| `currency` | String | enum `INR \| USD`, default **`USD`** |
| `period` | String | enum `weekly \| monthly \| quarterly \| yearly`, required |
| `interval` | Number | default 1, min 1 |
| `trialDays` | Number | default 0, min 0 |
| `isActive` | Boolean | default true (plans are deactivated, not deleted) |
`timestamps: true`.

### Indexes
`{ itemType, itemId, isActive }` (plans for an item); `{ orgId, isActive }`; `{ sellerId, isActive }`.

## Exports
- `SubscriptionPlan` - Mongoose model `"SubscriptionPlan"` (collection `subscriptionplans`).
- `ISubscriptionPlan` - document interface.
- `SubscriptionItemType` - `"channel" | "course" | "workshop" | "product"`.
- `SubscriptionPeriod` - `"weekly" | "monthly" | "quarterly" | "yearly"`.

## Interfaces
- **Database:** `SubscriptionPlan` (collection `subscriptionplans`), read and written.
- **External services:** each document corresponds to a Razorpay plan.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/middleware/subscriptionAccess.ts`, `server/models/subscription.model.ts` (type import), `server/routes/feed.ts`, `server/routes/subscriptionAdmin.ts`, `server/routes/subscriptions.ts` (for example `POST /backend/subscriptions/plans`, `GET /backend/subscriptions/plans/:itemType/:itemId`, `DELETE /backend/subscriptions/plans/:planId`), `server/services/subscription.ts`.

## Notes
- The interface comment says "In paise (INR)", but the currency default is `USD`. Read `amount` as the smallest unit of whatever `currency` holds.
