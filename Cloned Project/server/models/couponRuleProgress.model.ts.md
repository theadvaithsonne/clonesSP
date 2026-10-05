# `server/models/couponRuleProgress.model.ts`

> Mongoose model holding one progress counter per (user, coupon rule): qualifying purchases so far and how many times the rule has rewarded that user.

**Kind:** Mongoose model · **Lines:** 44

## Purpose
Purchase-based coupon rules (`CouponRule`) fire when a user's cumulative purchases cross a threshold. Instead of replaying the user's whole invoice history at every payment, the rule engine keeps a running snapshot here.

## How it works
- `userId` (ref `User`) and `ruleId` (ref `CouponRule`), both required and indexed; a unique compound index `{userId, ruleId}` guarantees one row per pair.
- `purchaseCount` - cumulative qualifying quantity since the rule became effective.
- `firedTimes` - how many times the rule has granted rewards to this user; `lastFiredAt` - when it last fired.
- `timestamps: true`.

In `evaluateRulesForInvoice` (`server/services/couponRule.ts`) the row is upserted atomically with `$inc: {purchaseCount}`. The engine then computes the target number of fires (`floor(purchaseCount / triggerQuantity)`, capped at 1 for `once` rules), grants only the difference from `firedTimes`, and saves the new `firedTimes` / `lastFiredAt`. The existence of any progress row also locks a rule's trigger/reward quantities against edits, and deleting a rule deletes its progress rows.

## Exports
- `CouponRuleProgress` - Mongoose model (`"CouponRuleProgress"`, collection `couponruleprogresses`).
- `ICouponRuleProgress` - document interface.

## Interfaces
- **Database:** `CouponRuleProgress` (collection `couponruleprogresses`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/couponRule.ts`.

## Notes
- The purchase-count increment is atomic, but the `firedTimes` update is a separate save after granting the coupon; two payments evaluated concurrently for the same user could both see the old `firedTimes` and over-grant.
