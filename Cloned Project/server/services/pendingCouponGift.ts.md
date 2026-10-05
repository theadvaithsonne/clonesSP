# `server/services/pendingCouponGift.ts`

> Module exporting `createPendingGift`, `approvePendingGift`, `rejectPendingGift`, `cancelPendingGift` and 3 more.

**Kind:** backend service · **Lines:** 557

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PendingGiftError` | class | `extends Error` — Paid coupon-gift service. | 21 |
| `CreatePendingGiftInput` | interface |  | 38 |
| `createPendingGift` | function | `async createPendingGift(input: CreatePendingGiftInput): Promise<IPendingCouponGift>` | 47 |
| `approvePendingGift` | function | `async approvePendingGift(offerId: string, recipientId: string): Promise<IPendingCouponGift>` | 173 |
| `rejectPendingGift` | function | `async rejectPendingGift(offerId: string, recipientId: string): Promise<IPendingCouponGift>` | 361 |
| `cancelPendingGift` | function | `async cancelPendingGift(offerId: string, senderId: string): Promise<IPendingCouponGift>` | 368 |
| `listIncomingPending` | function | `async listIncomingPending(userId: string)` | 379 |
| `listOutgoingPending` | function | `async listOutgoingPending(userId: string)` | 388 |
| `EligibilityRow` | interface |  | 401 |
| `searchRecipientEligibility` | function | `async searchRecipientEligibility(senderId: string, orgId: string, priceUsd: number, searchTerm: string, limit = 20): Promise<EligibilityRow[]>` — Search candidate recipients by name/email and return their store wallet balance in the sender's current org. | 416 |

## Interfaces

- **Database (Mongoose models used):**
  - `CouponAssignment` (server/models/couponAssignment.model.ts) — reads: `findById`; **writes:** `updateOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`, `find`, `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`, `find`
  - `PendingCouponGift` (server/models/pendingCouponGift.model.ts) — reads: `findById`, `find`; **writes:** `create`
  - `UserNotification` (server/models/userNotification.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/pendingCouponGift.model.ts` — `PendingCouponGift`, `IPendingCouponGift`, `PendingCouponGiftStatus`
  - `server/models/couponAssignment.model.ts` — `CouponAssignment`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/user.model.ts` — `User`
  - `server/models/userNotification.model.ts` — `UserNotification`
  - `server/services/couponAssignment.ts` — `transferAssignment`
  - `server/services/wallet.ts` — `transferStoreCredits`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/userRewards.ts`
