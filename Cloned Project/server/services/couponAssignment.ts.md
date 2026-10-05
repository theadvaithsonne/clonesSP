# `server/services/couponAssignment.ts`

> Module exporting `assignCoupon`, `transferAssignment`, `revokeAssignment`, `listAssignmentsForUser` and 3 more.

**Kind:** backend service · **Lines:** 549

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AssignCouponInput` | interface |  | 79 |
| `assignCoupon` | function | `async assignCoupon(input: AssignCouponInput): Promise<ICouponAssignment>` | 98 |
| `transferAssignment` | function | `async transferAssignment(input: { fromAssignmentId: string; fromUserId: string; toUs…): Promise<ICouponAssignment>` — Peer-to-peer transfer: revoke the sender's assignment and create a fresh active assignment for the recipient. | 291 |
| `revokeAssignment` | function | `async revokeAssignment(assignmentId: string, revokedByUserId: string, revokedByType: "garage_admin" \| "founder" \| "system", revokerOrgId?: string): Promise<ICouponAssignment \| null>` | 419 |
| `listAssignmentsForUser` | function | `async listAssignmentsForUser(userId: string, options: { status?: string } = {}): Promise<ICouponAssignment[]>` | 453 |
| `listAssignmentsForCoupon` | function | `async listAssignmentsForCoupon(couponId: string, couponSource: CouponAssignmentSource): Promise<ICouponAssignment[]>` | 462 |
| `markAssignmentUsed` | function | `async markAssignmentUsed(userId: string, couponId: string, couponSource: CouponAssignmentSource, redemptionRef?: string): Promise<void>` — Decrement an active assignment's `availableUses` when the user redeems the coupon. | 482 |
| `hasActiveAssignment` | function | `async hasActiveAssignment(userId: string, couponId: string, couponSource: CouponAssignmentSource): Promise<boolean>` — Called when a user tries to validate/apply a coupon. | 533 |
| `PlatformCouponRedemption` | export |  | 548 |

## Interfaces

- **Database (Mongoose models used):**
  - `PlatformCoupon` (server/models/platformCoupon.model.ts) — reads: `findById`
  - `Coupon` (server/models/coupon.model.ts) — reads: `findById`
  - `User` (server/models/user.model.ts) — reads: `findById`
  - `CouponAssignment` (server/models/couponAssignment.model.ts) — reads: `findOne`, `findById`, `find`, `exists`; **writes:** `create`, `findByIdAndUpdate`, `findOneAndUpdate`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/couponAssignment.model.ts` — `CouponAssignment`, `ICouponAssignment`, `CouponAssignmentSource`
  - `server/models/platformCoupon.model.ts` — `PlatformCoupon`
  - `server/models/platformCouponRedemption.model.ts` — `PlatformCouponRedemption`
  - `server/models/coupon.model.ts` — `Coupon`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`, `couponAssignedEmailTemplate`, `couponGiftedEmailTemplate`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/founderPlatformCoupons.ts`
- `server/routes/platformCoupons.ts`
- `server/routes/userRewards.ts`
- `server/scripts/grant-licence-coupons.ts`
- `server/services/couponRule.ts`
- `server/services/invoice.ts`
- `server/services/pendingCouponGift.ts`
- `server/services/storeCouponCommission.ts`
