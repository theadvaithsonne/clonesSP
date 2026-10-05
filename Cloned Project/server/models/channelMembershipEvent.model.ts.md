# `server/models/channelMembershipEvent.model.ts`

> Mongoose model `ChannelMembershipEvent` (collection `channelmembershipevents`) with 18 top-level fields.

**Kind:** Mongoose model · **Lines:** 206

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ChannelMembershipEvent`

- **Collection:** `channelmembershipevents` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `userId` | `Schema.Types.ObjectId` | required, ref "User" |
| `channelId` | `Schema.Types.ObjectId` | default null, ref "Channel" |
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `eventType` | `String` | required, enum ["unsubscribed", "expired", "payment_defaul… |
| `itemKind` | `String` | default "channel", enum ["channel", "workshop"] |
| `workshopId` | `Schema.Types.ObjectId` | default null, ref "Workshop" |
| `sessionDate` | `Date` | default null |
| `occurredAt` | `Date` | required, default Date.now |
| `channelKind` | `String` | required, enum ["free", "one_time", "recurring"] |
| `subscriptionPeriod` | `String` | default null, enum ["weekly", "monthly", "quarterly", "yearly"… |
| `accessUntil` | `Date` | default null |
| `activeDaysUsed` | `Number` | default null |
| `activeDaysLeftAtCancel` | `Number` | default null |
| `lifetimeValueUsdSnapshot` | `Number` | default 0 |
| `parentInvoiceId` | `Schema.Types.ObjectId` | default null, ref "Invoice" |
| `membershipId` | `Schema.Types.ObjectId` | required |
| `customerEmailSnapshot` | `String` | default null |
| `customerNameSnapshot` | `String` | default null |

### Indexes

- `{ orgId: 1, occurredAt: -1 }` (L184)
- `{ channelId: 1, occurredAt: -1 }` (L186)
- `{ membershipId: 1, eventType: 1, }` (L189)
- `{ orgId: 1, itemKind: 1, occurredAt: -1, }` (L194)
- `{ workshopId: 1, occurredAt: -1 }` (L200)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ChannelMembershipEventType` | type | ChannelMembershipEvent — append-only log of significant transitions on a ChannelMembership row. | 38 |
| `ChannelMembershipChannelKind` | type |  | 42 |
| `MembershipItemKind` | type |  | 46 |
| `IChannelMembershipEvent` | interface |  | 48 |
| `ChannelMembershipEvent` | model | `model<IChannelMembershipEvent>( "ChannelMembershipEvent", ChannelMembershipEventSchema )` | 202 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/routes/feed.ts`
- `server/services/channelMembershipEvent.ts`
- `server/services/downlineMemberPurchases.ts`
