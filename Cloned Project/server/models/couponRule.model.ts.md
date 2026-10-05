# `server/models/couponRule.model.ts`

> Mongoose model for purchase-based coupon automation rules: "if a user buys N of item X, grant them M uses of coupon Y".

**Kind:** Mongoose model · **Lines:** 146

## Purpose
Coupon rules let founders (for their own org's items) and Garage admins (for platform-level items) reward buyers automatically. When an invoice is paid, the rule engine in `server/services/couponRule.ts` checks matching rules, counts qualifying purchases per user, and grants `PlatformCoupon` uses through `CouponAssignment` rows. This model is the rule definition; per-user progress lives in `CouponRuleProgress`.

## How it works
- **Scope:** `scope` is `organization` (default; founder rule, only triggered by purchases through that org's checkouts) or `platform` (admin rule, triggered by anyone buying the configured platform item). `orgId` is required for organisation scope, but that is enforced in the service, not the schema. Rows created before `scope` existed have `scope` undefined plus an `orgId`, and the service treats them as organisation scope.
- **Type:** `type` is always `purchase_based` for now.
- **Trigger:** `triggerProductType` (`CouponRuleProductType`: `channel`, `course`, `workshop`, `product`, `service`, `call`, `office_plan`, `unilevel_plus`, `third_party_subscription`, `ecommerce`; the first six/ecommerce are org items, the platform ones are office plans, Unilevel Plus and third-party subscriptions). `triggerItemId` is optional: when missing, the rule is a wildcard that fires on any purchase of that product type (used for admin rules over third-party subscriptions whose partner records may not exist yet). `triggerQuantity` (min 1, default 1) is the threshold.
- **Reward:** `rewardCouponId` (ref `PlatformCoupon`, required) and `rewardQuantity` (uses granted per fire, min 1).
- **Recurrence:** `once` (default; fire the first time the threshold is crossed) or `every` (fire on every additional crossing).
- `isActive` (default true), `effectiveFrom` (defaults to creation time; only purchases paid after it count, so existing customers are never rewarded retroactively), `createdBy` (User), `timestamps`.
- **Indexes:** single-field on `scope`, `orgId`, `triggerItemId`, `isActive`; compound `{orgId, isActive}`, `{scope, isActive}`, `{triggerItemId, isActive}`.

**Evaluation** (`evaluateRulesForInvoice`, called from `server/services/invoice.ts` when an invoice is paid): for each line item, find active rules whose scope matches (this org or platform), whose target matches (specific item or wildcard product type), and whose `effectiveFrom` is before `paidAt`. Renewal cycles of recurring items are skipped. It `$inc`s `CouponRuleProgress.purchaseCount` (by the line quantity, or 1 for recurring items), computes `floor(purchaseCount / triggerQuantity)` (capped at 1 for `once`), and grants `newFires x rewardQuantity` uses via `assignCoupon` with `mergeAvailableUses: true`, attributed to the rule creator as `garage_admin` or `founder`. Once any progress exists, `updateCouponRule` locks `triggerQuantity` and `rewardQuantity`; deleting a rule also deletes its progress rows.

## Exports
- `CouponRule` - Mongoose model (`"CouponRule"`, collection `couponrules`).
- `ICouponRule` - document interface.
- Types: `CouponRuleType` (`"purchase_based"`), `CouponRuleRecurrence` (`"once" | "every"`), `CouponRuleScope` (`"platform" | "organization"`), `CouponRuleProductType`.

## Interfaces
- **Database:** `CouponRule` (collection `couponrules`) - read/write; refs `Organization`, `PlatformCoupon`, `User`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/couponRule.ts` only. That service backs `server/routes/founderCouponRules.ts` (mounted at `/org/:orgId/coupon-rules`, browser `/backend/org/:orgId/coupon-rules`) and `server/routes/adminCouponRules.ts` (`/garage-admin/coupon-rules`).

## Notes
- Rewards always come from the newer `PlatformCoupon` system (`couponSource: "platform"`), never the legacy `Coupon` model.
- The wildcard query matches `triggerItemId: {$in: [null, undefined]}`.
