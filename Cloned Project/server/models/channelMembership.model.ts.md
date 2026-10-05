# `server/models/channelMembership.model.ts`

> Mongoose model `ChannelMembership` (collection `channelmemberships`) with 13 top-level fields.

**Kind:** Mongoose model · **Lines:** 54

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChannelMembership`

- **Collection:** `channelmemberships` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, ref "User" |
| `channelId` | `Schema.Types.ObjectId` | required, ref "Channel" |
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `joinedAt` | `Date` | default Date.now |
| `role` | `String` | default "member", enum ["member", "admin"] |
| `status` | `String` | default "active", enum ["active", "inactive", "suspended"] |
| `subscriptionId` | `String` | — |
| `subscriptionStatus` | `String` | enum ["active", "cancelled", "expired"] |
| `lastPaymentDate` | `Date` | — |
| `nextPaymentDate` | `Date` | — |
| `cancelledAt` | `Date` | — |
| `lastActivityAt` | `Date` | — |
| `canPost` | `Boolean` | default true |

### Indexes

- `{ userId: 1, orgId: 1 }` (L43)
- `{ channelId: 1, status: 1 }` (L44)
- `{ userId: 1, channelId: 1 }, { unique: true }` (L45)
- `{ subscriptionStatus: 1, nextPaymentDate: 1 }` (L48)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChannelMembership` | model | `model( "ChannelMembership", ChannelMembershipSchema )` | 50 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`

## Used by

- `server/index.ts`
- `server/routes/callCheckout.ts`
- `server/routes/channelCheckout.ts`
- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/learnInit.ts`
- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/routes/public.ts`
- `server/routes/publicMeet.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/workshopCheckout.ts`
- `server/scripts/backfill-channel-members.ts`
- `server/scripts/migrate-affiliate.ts`
- `server/scripts/rollback-affiliate.ts`
- `server/services/channel.ts`
- `server/services/channelMembership.ts`
- `server/services/downlineMemberPurchases.ts`
- `server/services/feed.ts`
- `server/services/invoice.ts`
- `server/services/itemReserveLicense.ts`
- `server/services/memberCleanup.service.ts`
- `server/services/review.ts`
- `server/services/workshop.ts`
