# `server/bat246/models/bat246Distributor.model.ts`

> Mongoose model for a BAT246 distributor profile: one document per Garage user, tracking their qualification steps, referral attribution, invite and placement history, and a cached copy of their display details.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 121

## Purpose
A Garage user becomes a "BAT246 Distributor" by completing four qualification steps:
1. office membership;
2. BAT246 membership;
3. buying an entry product ($650 board or $160 POD);
4. Garage Affiliate (Unilevel Plus).

This document tracks each step separately, works out `isQualified` from them, and stores how the person was invited and where they were placed. The admin Distributors and Inviteandplace grids read it, as do the checkout, invoice and office routes that flip the flags when purchases complete. It is separate from `Bat246Player` (the in-game identity); `playerId` links the two.

## How it works
Fields (`timestamps: true`), grouped:

- **Identity:**
  - `userId` (→ `User`): required, unique, indexed.
  - `playerId` (→ `bat246Players`): indexed.
  - `firstName` and `lastName`: cached name split.
  - `distributorId`: unique and sparse. `assignDistributorId()` in `bat246DistributorId.util.ts` assigns it on first qualification as `<Bat246Config.distributorIdCounter><first initial><last initial>`; for example, the name "Bat246-1" becomes `1001B1`.
- **`userSnapshot`:** `name`, `email`, `phone`, `profilePicture`, `country`, `state`, `city`, `postalCode`. A copy of the User's display fields that survives if the account is deleted.
  - It was added after `/games/bat246/distributors` crashed on a `null` populate result (33 seed/test distributors pointed to deleted users).
  - `assignDistributorId()` writes it once, at qualification time.
  - `listDistributors` in `bat246.controller.ts` refreshes it whenever the live user still exists.
  - Display code should read this snapshot and never depend on `populate("userId")`.
- **`countryOfBirth`:** collected on the BAT246 Complete Profile step (`bat246Profile.routes.ts`). It is deliberately kept apart from `userSnapshot.country` (the country of residence) and is never written to `User`.
- **Qualification flags, each updated independently:**
  - `isOfficeMember`;
  - `isGarageAffiliate` and `garageAffiliateExpiresAt`;
  - `hasBat246Membership` and `membershipExpiresAt`;
  - `hasPurchasedProduct`.
- **Derived state:** `isQualified`, `qualifiedAt`, `disqualifiedAt`, recomputed whenever a flag changes. For example, `server/routes/invoice.ts` sets `isQualified` once office membership, BAT246 membership and a product purchase are all true, then calls `assignDistributorId()`.
- **Referral attribution:**
  - `bat246RefUserId`: the inviter, from the `bat246Ref` link parameter.
  - `bat246RefBoardId`: the board an "unassigned" invite link pointed to, used as a placement hint.
  - `invitedProductId`: which product the admin "+ Invite" flow offered ($650 vs $160). It decides which product the "Path to Bat246 Distributor" step 4 call-to-action shows.
- **Admin approval:** `isApproved`, `approvedAt`. Approval marks the distributor as ready to be placed on a board.
- **POD invite tracking** (the "Invite To POD" columns):
  - `podInvitedByUserId`, `podInvitedByEmail`, `podInvitedByName`: first-touch, set once and never overwritten by reminders.
  - `podInviteSentAt`: the most recent send.
  - `podInviteCount`.
  - `podPurchaseCompletedAt`.
  - `podPurchaseCreditedToUserId`: a permanent copy, taken at purchase time, of who gets credit.
- **POD placement:** `podPlacedBoardId`, `podPlacedAt`, `podPlacedByUserId`, and `podPlacedPositionKey`. The key is `pod-0`, `pod-1` or `pod-2` for the visual seats, or a real board position (`1stA`, `atBat-3`, `dugout`, ...) for the fourth entrant. `placeUserInPod()` writes these fields.
- **$650 board invite tracking:** `boardInvitedByUserId`, `boardInvitedByEmail`, `boardInvitedByName`, `boardInviteSentAt`, `boardInviteCount`. Same first-touch pattern as POD. "Ready to place" for a board is driven by `isQualified`, not by a separate purchase field.
- **Board placement through the "Ready to be placed on board" button:** `boardPlacedBoardId`, `boardPlacedPositionKey`, `boardPlacedAt`, `boardPlacedByUserId`. Written by `placeDistributorOnBoard()` in `bat246BoardInvite.service.ts`. This path and the admin / 1st-Base Approve flow both end by setting the same `isApproved` flag.

Index: `{ isQualified: 1, createdAt: -1 }`, plus the indexes declared inline.

## Exports
- `Bat246Distributor` - Mongoose model registered as `"bat246Distributors"`.

## Interfaces
- **Database:** collection `bat246distributors`. Read and written by BAT246 services and routes, and by the shared commerce routes `server/routes/invoice.ts`, `productCheckout.ts`, `office.ts`, `profile.ts` and `unilevel-plus.ts`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/bat246/controllers/bat246.controller.ts`, `server/bat246/routes/bat246.routes.ts`, `server/bat246/routes/bat246Profile.routes.ts`, `server/bat246/scripts/backupAndWipeBat246.ts`, `server/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts`, `server/bat246/scripts/test-activate-garage-affiliate-boifeyaddequeu.ts`, `server/bat246/services/bat246.service.ts`, `bat246Admin.service.ts`, `bat246BoardInvite.service.ts`, `bat246Country.util.ts`, `bat246DistributorId.util.ts`, `bat246Entry.service.ts`, `bat246MembershipBilling.service.ts`, `bat246PodInvite.service.ts`, `bat246SnapBackLoan.service.ts`, `server/routes/invoice.ts`, `server/routes/office.ts`, `server/routes/productCheckout.ts`, `server/routes/profile.ts`, `server/routes/unilevel-plus.ts`, `server/scripts/bat246-backfill-auto-placement.ts`, `server/scripts/bat246-test-board-create.ts`, `server/scripts/bat246-test-board-delete.ts`, `server/scripts/bat246-who-referred.ts`, `server/scripts/debugBat246Dist.ts`, and 7 more.

## Notes
- `isQualified` is stored, not computed in the schema. Every code path that changes a qualification flag must recompute it, or the stored value goes stale.
- The first write to `bat246RefUserId` wins: callers use `$setOnInsert`, as `bat246OfficeInvite.model.ts` describes.
- `distributorId` is permanent once assigned (`assignDistributorId()` does nothing if it is already set), even if the person later loses qualification.
