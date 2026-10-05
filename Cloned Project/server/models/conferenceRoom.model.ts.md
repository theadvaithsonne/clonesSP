# `server/models/conferenceRoom.model.ts`

> Mongoose model `ConferenceRoom` (collection `conferencerooms`) with 5 top-level fields.

**Kind:** Mongoose model · **Lines:** 76

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `ConferenceRoom`

- **Collection:** `conferencerooms` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `orgId` | `Schema.Types.ObjectId` | required, index, ref "Organization" |
| `name` | `String` | required, trim |
| `createdBy` | `Schema.Types.ObjectId` | required, ref "User" |
| `isActive` | `Boolean` | default true |
| `scheduledDeactivationAt` | `Date` | — |

### Indexes

- `{ orgId: 1, name: 1 }, { unique: true }` (L58)
- `{ orgId: 1, isActive: 1 }` (L59)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IConferenceRoom` | interface |  | 18 |
| `ConferenceRoom` | model | `model<IConferenceRoom>( "ConferenceRoom", ConferenceRoomSchema, )` | 61 |
| `conferenceRoomSpaceId` | function | `conferenceRoomSpaceId(orgId: string \| Types.ObjectId, conferenceRoomId?: string \| Types.ObjectId): string` | 68 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Types`

## Used by

- `server/realtime/socket.ts`
- `server/routes/conferenceRoom.ts`
- `server/routes/officeCheckout.ts`
- `server/routes/org.ts`
- `server/services/conferenceRoomBilling.ts`
