# `server/models/webinarAttendance.model.ts`

> Mongoose model `WebinarAttendance` (collection `webinarattendances`) with 12 top-level fields.

**Kind:** Mongoose model · **Lines:** 89

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `WebinarAttendance`

- **Collection:** `webinarattendances` (default pluralised name)
- **Schema options:** `timestamps: true`

| Field | Type | Flags |
|---|---|---|
| `workshopId` | `Schema.Types.ObjectId` | required, index, ref "Workshop" |
| `orgId` | `Schema.Types.ObjectId` | required, ref "Organization" |
| `sessionDate` | `Date` | required |
| `userId` | `Schema.Types.ObjectId` | required, index, ref "User" |
| `name` | `String` | — |
| `email` | `String` | — |
| `role` | `String` | default "attendee", enum ["host", "panelist", "attendee"] |
| `firstJoinedAt` | `Date` | required |
| `lastJoinedAt` | `Date` | required |
| `lastLeftAt` | `Date` | — |
| `totalSeconds` | `Number` | default 0 |
| `joinCount` | `Number` | default 1 |

### Indexes

- `{ workshopId: 1, sessionDate: 1, userId: 1 }, { unique: true }` (L80)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IWebinarAttendance` | interface | Someone who was actually in a live session. | 26 |
| `WebinarAttendance` | model | `model<IWebinarAttendance>( "WebinarAttendance", WebinarAttendanceSchema )` | 85 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Schema`, `model`, `Document`, `Types`

## Used by

- `server/realtime/mediasoupHandlers.ts`
- `server/routes/publicWebinar.ts`
- `server/routes/webinarRoutes.ts`
- `server/services/downlineMemberLiveStreams.ts`
