# `server/models/couponAssignment.model.ts`

> Mongoose model for a coupon given to a specific user as a reward, shown in that user's "Rewards" tab and redeemable (possibly several times) at checkout.

**Kind:** Mongoose model · **Lines:** 130

## Purpose
A `CouponAssignment` turns a coupon into a personal reward. Garage admins, founders, the system (coupon rules) or other users (peer gifts) can assign a coupon to someone; while the row is active the coupon appears in the recipient's Rewards tab. It works for both coupon systems: `couponSource: "platform"` refers to a `PlatformCoupon`, `"legacy"` to a `Coupon`.

## How it works
- **Who and what:** `userId` (recipient), `couponId` (no `ref`, because it can point at either collection), `couponSource`, and `couponCode` (snapshotted for audit even if the coupon is renamed or removed).
- **Status:** `active` (default), `used`, `revoked`, `expired`. A row becomes `used` once its uses run out, or `revoked` if the assigner removes it (or the holder gifts it away).
- **Assigner:** `assignedBy` (User), `assignedByType` (`garage_admin`, `founder`, `system`, `user`), `assignerOrgId` for founder assignments, and an optional `reason` shown to the user (max 500).
- **Peer gifts:** `giftedFromUserId`, `parentAssignmentId` (the sender's revoked assignment that produced this one) and `giftMessage` (max 280).
- **Multi-use:** `availableUses` (default 1, min 0). Direct gifts grant 1; coupon rules can grant more (for example "buy 3 of X, get 5 uses"). Each redemption decrements it and the status flips to `used` only at 0.
- **Expiry and redemption:** optional `expiresAt` (independent of the coupon's own `validUntil`), `redemptionRef`, `redeemedAt`, `revokedAt`.
- **Paid gift lock:** `pendingGiftId` (ref `PendingCouponGift`) is set while a paid gift offer awaits the recipient's approval; the coupon cannot be redeemed or re-gifted until the offer is approved, rejected or cancelled.
- `timestamps: true`.
- **Indexes:** unique `{userId, couponId, couponSource}` (one row per user per coupon) and `{userId, status, createdAt:-1}` for the Rewards tab.

Because of the unique index, `assignCoupon` in `server/services/couponAssignment.ts` reuses the existing row: it re-arms a revoked/expired row (clearing gift breadcrumbs), tops up `availableUses` with `$inc` when a rule re-fires and merging is requested, or leaves an already active/used row alone. `transferAssignment` revokes the sender's row and upserts the recipient's row with lineage fields; `markAssignmentUsed` decrements uses and refuses while `pendingGiftId` is set.

## Exports
- `CouponAssignment` - Mongoose model (`"CouponAssignment"`, collection `couponassignments`).
- `ICouponAssignment` - document interface.
- `CouponAssignmentSource` - `"platform" | "legacy"`.
- `CouponAssignmentStatus` - `"active" | "used" | "revoked" | "expired"`.

## Interfaces
- **Database:** `CouponAssignment` (collection `couponassignments`) - read/write; refs `User`, `Organization`, `CouponAssignment`, `PendingCouponGift`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/couponAssignment.ts`, `server/services/pendingCouponGift.ts`, `server/services/platformCoupon.ts`, `server/routes/rewards.ts` (mounted at `/checkout`, browser `/backend/checkout`) and `server/routes/userRewards.ts` (`/me/rewards`, browser `/backend/me/rewards`).

## Notes
- The unique index means a user can never hold two separate assignments of the same coupon; extra grants must be expressed through `availableUses`.
- Older rows may lack `availableUses`; `markAssignmentUsed` handles a missing value as a legacy single-use row.
