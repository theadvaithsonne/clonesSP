# `server/middleware/subscriptionAccess.ts`

> Middleware factories that gate or annotate requests based on a user's recurring `Subscription` to a channel, course, workshop or product.

**Kind:** Express middleware · **Lines:** 226

## Purpose
These guards were written so that routes for subscription-gated content (channels, courses, workshops and products sold on recurring plans) can check in one place for a paid, unexpired subscription. They also cover routes that manage a single subscription and must be limited to its buyer or its seller. Each guard assumes `requireAuth` has already set `req.user.userId`.

## How it works

### Item-based checks
Both factories take an `itemType` (`SubscriptionItemType`: `channel | course | workshop | product`) and an optional route-parameter name. By default the parameter is `channelId`, `courseId`, `workshopId` or `productId` respectively.

- **`requireActiveSubscription(itemType, itemIdParam?)`** blocks the request unless the user has a matching subscription.
  - It returns 401 with no user and 400 when the parameter is missing.
  - It queries `Subscription.findOne({ userId, itemType, itemId, status: { $in: ["active", "authenticated"] } })`.
  - If none is found, it returns **403** `SUBSCRIPTION_REQUIRED`. If `currentEnd` is in the past, it returns **403** `SUBSCRIPTION_EXPIRED` with `expiredAt`.
  - On success it attaches `req.subscription`. Errors return 500.
- **`checkSubscriptionStatus(itemType, itemIdParam?)`** never blocks. It loads the newest subscription for the user and item (`sort({ createdAt: -1 })`, with no status filter) and sets `req.subscriptionStatus = { hasSubscription, isActive, subscription?: { id, status, currentEnd, paidCount } }`.
  - `isActive` requires a status of `active` or `authenticated` and either no `currentEnd` or a `currentEnd` that has not yet passed.
  - With no user or no parameter, and on errors, it sets `hasSubscription: false`. On errors it also adds an `error` string, then continues.

### Checks on a single subscription
Both read `req.params.subscriptionId` and load it with `Subscription.findById`. They return 401, 400 or 404 for the corresponding failures, attach `req.subscription` on success, and return 500 on errors.
- **`requireSubscriptionOwnerOrAdmin()`** returns 403 unless `subscription.userId` equals the caller. Despite the name, there is **no admin bypass**; the code has a `TODO: Add admin check here if needed`.
- **`requireSubscriptionSeller()`** returns 403 unless `subscription.sellerId` equals the caller.

## Exports
- `requireActiveSubscription(itemType, itemIdParam?)` - blocking gate that requires an active, unexpired subscription.
- `checkSubscriptionStatus(itemType, itemIdParam?)` - non-blocking; attaches `req.subscriptionStatus`.
- `requireSubscriptionOwnerOrAdmin()` - only the subscription's buyer may pass.
- `requireSubscriptionSeller()` - only the subscription's seller may pass.

## Interfaces
- **Database:** `Subscription` (model `Subscription`) - read only. The `SubscriptionItemType` type comes from `subscriptionPlan.model.ts`.

## Dependencies
- **Internal:**
  - `server/models/subscription.model.ts` - `Subscription`.
  - `server/models/subscriptionPlan.model.ts` - the `SubscriptionItemType` type.
- **Packages:** `express`, and `mongoose` (`Types.ObjectId` for the query casts).

## Used by
Nothing imports this file; it appears unused. Subscription routes seem to do their own checks inline.

## Notes
- `new Types.ObjectId(itemId)` throws on a malformed ID. In `requireActiveSubscription` that produces a 500 rather than a 400.
- The default parameter map is duplicated in both item-based factories.
