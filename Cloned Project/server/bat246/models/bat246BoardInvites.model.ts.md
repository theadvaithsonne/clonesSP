# `server/bat246/models/bat246BoardInvites.model.ts`

> Append-only Mongoose audit log with one row for every "invite" or "remind" email sent for the $650 BAT246 Board Entry product.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 21

## Purpose
The Inviteandplace admin page has "Invite To Board" and "Board Invite Status" columns. Every invite or reminder email sent from there is logged here for future reporting. The latest-state summary lives on `Bat246Distributor` (`boardInvitedByUserId`, `boardInviteSentAt`, `boardInviteCount`, ...). This collection keeps the full history and copies `bat246PodInvites.model.ts` field for field.

## How it works
Fields (`timestamps: false`):
- `targetUserId` (→ `User`) and `targetEmail`: the person invited. Both required.
- `invitedByUserId` (→ `User`) and `invitedByEmail`: the sender. Both required.
- `invitedByName`: defaults to `""`.
- `productId` (→ `Product`, required).
- `type`: `"invite"` or `"remind"`, required.
- `sentAt`: defaults to now.

Index: `{ targetUserId: 1, sentAt: -1 }`, for the newest-first history of one target.

The comment says rows are never updated or deleted.

## Exports
- `Bat246BoardInvite` - Mongoose model registered as `"bat246BoardInvites"`.

## Interfaces
- **Database:** collection `bat246boardinvites`. `bat246BoardInvite.service.ts` writes it (`create`). No code in the repo reads it back yet.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/services/bat246BoardInvite.service.ts` (only importer).
