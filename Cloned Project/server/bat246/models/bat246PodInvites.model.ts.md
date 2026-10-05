# `server/bat246/models/bat246PodInvites.model.ts`

> Append-only Mongoose audit log with one row for every "invite" or "remind" email sent for the BAT246 POD Entry product ($160).

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 19

## Purpose
The admin Distributors and Inviteandplace grids have "Invite To POD" and "POD Invite Status" columns. The latest state (first inviter, last send time, count) is stored on `Bat246Distributor` in its `podInvited*` fields. This collection keeps the full history of every send for future reporting. `bat246BoardInvites.model.ts` is an exact copy of it for the $650 Board Entry product.

## How it works
Fields (`timestamps: false`):
- `targetUserId` (→ `User`) and `targetEmail`: the person invited. Both required.
- `invitedByUserId` (→ `User`) and `invitedByEmail`: the sender. Both required.
- `invitedByName`: defaults to `""`.
- `productId` (→ `Product`, required).
- `type`: `"invite"` or `"remind"`, required.
- `sentAt`: defaults to now.

Index: `{ targetUserId: 1, sentAt: -1 }`.

The comment says rows are never updated or deleted.

## Exports
- `Bat246PodInvite` - Mongoose model registered as `"bat246PodInvites"`.

## Interfaces
- **Database:** collection `bat246podinvites`. `bat246PodInvite.service.ts` writes it (`create`). No code reads it back yet.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/services/bat246PodInvite.service.ts` (only importer).
