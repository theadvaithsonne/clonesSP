# `server/models/userNotification.model.ts`

> Mongoose model `UserNotification` (collection `usernotifications`) with 72 top-level fields.

**Kind:** Mongoose model · **Lines:** 156

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `UserNotification`

- **Collection:** `usernotifications` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, ref "User" |
| `orgId` | `Schema.Types.ObjectId` | ref "Organization" |
| `type` | `String` | required, enum [ "dm", "group_message", "knock", "global_d… |
| `dmFrom` | `Schema.Types.ObjectId` | ref "User" |
| `dmFromName` | `String` | — |
| `dmFromEmail` | `String` | — |
| `dmFromPicture` | `String` | — |
| `dmText` | `String` | — |
| `dmConvId` | `String` | — |
| `dmMessageId` | `Schema.Types.ObjectId` | — |
| `groupId` | `Schema.Types.ObjectId` | ref "Group" |
| `groupName` | `String` | — |
| `groupFrom` | `Schema.Types.ObjectId` | ref "User" |
| `groupFromName` | `String` | — |
| `groupFromEmail` | `String` | — |
| `groupFromPicture` | `String` | — |
| `groupText` | `String` | — |
| `groupMessageId` | `Schema.Types.ObjectId` | — |
| `knockFrom` | `Schema.Types.ObjectId` | ref "User" |
| `knockFromName` | `String` | — |
| `knockFromEmail` | `String` | — |
| `knockFromPicture` | `String` | — |
| `knockSpaceId` | `String` | — |
| `globalDmFrom` | `Schema.Types.ObjectId` | ref "User" |
| `globalDmFromName` | `String` | — |
| `globalDmFromEmail` | `String` | — |
| `globalDmFromPicture` | `String` | — |
| `globalDmText` | `String` | — |
| `globalDmConvId` | `String` | — |
| `globalDmMessageId` | `Schema.Types.ObjectId` | — |
| `postId` | `Schema.Types.ObjectId` | ref "Post" |
| `postAuthorId` | `Schema.Types.ObjectId` | ref "User" |
| `postAuthorName` | `String` | — |
| `postAuthorEmail` | `String` | — |
| `postAuthorPicture` | `String` | — |
| `postContent` | `String` | — |
| `channelId` | `Schema.Types.ObjectId` | ref "Channel" |
| `channelName` | `String` | — |
| `commentId` | `Schema.Types.ObjectId` | ref "PostComment" |
| `commentAuthorId` | `Schema.Types.ObjectId` | ref "User" |
| `commentAuthorName` | `String` | — |
| `commentAuthorEmail` | `String` | — |
| `commentAuthorPicture` | `String` | — |
| `commentContent` | `String` | — |
| `couponCode` | `String` | — |
| `couponName` | `String` | — |
| `assignmentId` | `Schema.Types.ObjectId` | ref "CouponAssignment" |
| `giftFromUserId` | `Schema.Types.ObjectId` | ref "User" |
| `giftFromName` | `String` | — |
| `giftFromPicture` | `String` | — |
| `giftFromType` | `String` | enum ["garage_admin", "founder", "user"] |
| `giftOrgName` | `String` | — |
| `giftMessage` | `String` | — |
| `reserveOfferId` | `Schema.Types.ObjectId` | ref "PendingReserveAssignment" |
| `reserveItemType` | `String` | enum ["course", "channel", "workshop", "call", "… |
| `reserveItemName` | `String` | — |
| `reservePriceUsd` | `Number` | — |
| `franchiseOfferId` | `Schema.Types.ObjectId` | ref "FranchiseOffer" |
| `franchiseAssignmentId` | `Schema.Types.ObjectId` | ref "FranchiseTerritoryAssignment" |
| `franchiseTerritoryName` | `String` | — |
| `franchiseOfferPriceUsd` | `Number` | — |
| `franchiseOfferEvent` | `String` | enum [ "created", // to owner "accepted", // to … |
| `franchiseInvoiceId` | `Schema.Types.ObjectId` | ref "Invoice" |
| `franchiseGlobalOfferId` | `Schema.Types.ObjectId` | ref "FranchiseGlobalOffer" |
| `franchiseGlobalAssignmentId` | `Schema.Types.ObjectId` | ref "FranchiseGlobalAssignment" |
| `grantId` | `Schema.Types.ObjectId` | ref "PermissionGrant" |
| `grantModule` | `String` | — |
| `grantModuleLabel` | `String` | — |
| `grantExpiresAt` | `Date` | — |
| `grantedByName` | `String` | — |
| `read` | `Boolean` | default false |
| `cleared` | `Boolean` | default false |

### Indexes

- `{ userId: 1, cleared: 1, createdAt: -1 }` (L148)
- `{ userId: 1, orgId: 1, cleared: 1 }` (L149)
- `{ userId: 1, read: 1 }` (L150)
- `{ userId: 1, type: 1, cleared: 1, createdAt: -1 }` (L151)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `UserNotification` | const | `= mongoose.models.UserNotification \|\| mongoose.model("UserNotification", UserNotification…` | 153 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`

## Used by

- `server/realtime/socket.ts`
- `server/routes/userNotifications.ts`
- `server/scripts/grant-licence-coupons.ts`
- `server/services/couponAssignment.ts`
- `server/services/feed.ts`
- `server/services/franchiseGlobalOffer.ts`
- `server/services/franchiseOffer.ts`
- `server/services/pendingCouponGift.ts`
- `server/services/pendingReserveAssignment.ts`
- `server/services/permissionGrant.ts`
- `server/services/supportChat.ts`
