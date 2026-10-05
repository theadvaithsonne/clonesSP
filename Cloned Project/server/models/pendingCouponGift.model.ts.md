# `server/models/pendingCouponGift.model.ts`

> Mongoose model for a paid coupon-gift offer that waits for the recipient's approval before any coupon or money moves.

**Kind:** Mongoose model · **Lines:** 117

## Purpose
Users can pass a coupon they hold to someone else. A free gift is instant (handled by `transferAssignment` in `server/services/couponAssignment.ts`) and creates no row here. A **paid** gift - the recipient pays the sender a USD price - needs the recipient's consent first, so it is parked in this collection until it is approved, rejected or cancelled.

## How it works
- **Lifecycle:** `pending` to one of `approved`, `rejected`, `cancelled`. There is no auto-expiry: a pending offer stays pending until the recipient acts or the sender cancels.
- **Coupon lock:** while the row is `pending`, the sender's `CouponAssignment.pendingGiftId` points at it, which blocks re-gifting or redeeming that coupon.
- **Fields:**
  - `fromUserId`, `toUserId` - refs `User`, required, indexed.
  - `fromAssignmentId` - ref `CouponAssignment`, required: the sender's coupon holding being offered.
  - `couponId` (required, no ref) and `couponSource` (`"platform"` = a `PlatformCoupon`, or `"legacy"`), telling the service which collection `couponId` points into.
  - `couponCode` - snapshot for display and audit, kept even if the coupon is renamed or removed.
  - `orgId` - ref `Organization`: the org whose Store wallets the payment moves through (store wallets are per org).
  - `priceUsd` - USD amount (2 decimal places), min 0.01.
  - `message` - optional, max 280 characters.
  - `status` - enum above, default `pending`, indexed.
  - `respondedAt`.
  - `resolutionTxRefs` (`_id: false`): `senderWalletTxId` and `recipientWalletTxId` (refs `WalletTransaction`) and `recipientAssignmentId` (ref `CouponAssignment`) - audit links to what the approval produced.
  - `timestamps: true`.
- **Indexes:**
  - Unique `{ fromAssignmentId: 1 }` with `partialFilterExpression: { status: "pending" }` - at most one pending offer per coupon assignment, so the sender-side lock holds under concurrency (a second insert fails with a duplicate-key error).
  - `{ toUserId: 1, status: 1, createdAt: -1 }` - recipient inbox.
  - `{ fromUserId: 1, status: 1, createdAt: -1 }` - sender outbox.

## Exports
- `PendingCouponGiftStatus` - `"pending" | "approved" | "rejected" | "cancelled"`.
- `IPendingCouponGift` - document interface.
- `PendingCouponGift` - the Mongoose model.

## Interfaces
- **Database:** `PendingCouponGift` (collection `pendingcoupongifts`); references `CouponAssignment`, `WalletTransaction`, `User`, `Organization`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/pendingCouponGift.ts` - `createPendingGift`, `approvePendingGift`, `rejectPendingGift`, `cancelPendingGift`, `listIncomingPending`, `listOutgoingPending`, `searchRecipientEligibility`.

## Notes
- The partial unique index only exists once indexes are built; if `autoIndex` is off in production it must be synced manually for the concurrency guarantee to hold.
- Sister model with the same pattern for reserve licences: `pendingReserveAssignment.model.ts`.
