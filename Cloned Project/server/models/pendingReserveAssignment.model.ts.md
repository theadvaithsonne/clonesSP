# `server/models/pendingReserveAssignment.model.ts`

> Mongoose model for a paid offer to hand a reserve licence (a pre-bought seat for a course, channel, workshop, call or product) to another user, pending the recipient's approval.

**Kind:** Mongoose model · **Lines:** 165

## Purpose
A user holding an `ItemReserveLicense` can assign it to someone else for a price. Nothing moves - neither the licence nor any money - until the recipient approves. This collection holds those offers. It mirrors `PendingCouponGift` (`pendingCouponGift.model.ts`) with one deliberate difference: payment can cross organizations.

## How it works
- **Lifecycle:** `pending` to `approved`, `rejected` or `cancelled`. No auto-expiry.
- **Licence lock:** while `status === "pending"`, the parent `ItemReserveLicense.pendingAssignmentId` points here, preventing the reserve from being re-assigned or used.
- **Cross-org payment:** the sender's credit lands in `orgId` (the sender's active org when the offer was created). The recipient chooses which of their own office Store wallets to pay from at approval time; that choice is passed to the service and is **not** stored on this document.
- **Fields:**
  - `fromUserId`, `toUserId` - refs `User`, required, indexed.
  - `fromLicenseId` - ref `ItemReserveLicense`, required.
  - Snapshot of the reserved item, so the inbox card renders even if the source changes: `itemType` (`course` / `channel` / `workshop` / `call` / `product`), `itemId`, `itemName`, optional `itemImage`, `unitPrice` (the licence's original unit price, audit only, min 0).
  - `orgId` - ref `Organization`, required.
  - `priceUsd` (min 0.01), `currency` (default `"USD"`), optional `message` (max 500).
  - `status` (default `pending`, indexed), `respondedAt`.
  - `resolutionTxRefs` (`_id: false`): `senderWalletTxId`, `recipientWalletTxId` (refs `WalletTransaction`) and `assignedArtifactRef` `{ type, id }` - a generic pointer to whatever the approval created for the recipient (the shape varies by item type).
  - `timestamps: true`.
- **Indexes:**
  - Unique `{ fromLicenseId: 1 }` with `partialFilterExpression: { status: "pending" }` - one pending offer per licence; a concurrent second insert fails with E11000.
  - `{ toUserId: 1, status: 1, createdAt: -1 }` (recipient inbox) and `{ fromUserId: 1, status: 1, createdAt: -1 }` (sender outbox).

## Exports
- `PendingReserveAssignmentStatus` - `"pending" | "approved" | "rejected" | "cancelled"`.
- `PendingReserveItemType` - `"course" | "channel" | "workshop" | "call" | "product"`.
- `IPendingReserveAssignment` - document interface.
- `PendingReserveAssignment` - the Mongoose model.

## Interfaces
- **Database:** `PendingReserveAssignment` (collection `pendingreserveassignments`); references `ItemReserveLicense`, `WalletTransaction`, `User`, `Organization`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/pendingReserveAssignment.ts` - `createPendingReserveAssignment`, `approvePendingReserveAssignment`, `rejectPendingReserveAssignment`, `cancelPendingReserveAssignment`, `listIncomingPendingReserves`, `listOutgoingPendingReserves`.

## Notes
- `assignedArtifactRef.type` is a free string, not an enum; consumers must agree on its values with the service.
