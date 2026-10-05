# `server/models/webinarMessage.model.ts`

> Mongoose model `WebinarMessage` (collection `webinarmessages`) with 10 top-level fields.

**Kind:** Mongoose model · **Lines:** 143

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `WebinarMessage`

- **Collection:** `webinarmessages` (default pluralised name)

| Field | Type | Flags |
|---|---|---|
| `workshopId` | `Schema.Types.ObjectId` | required, ref "Workshop" |
| `userId` | `String` | required |
| `userName` | `String` | required |
| `text` | `String` | trim, default "" |
| `replyTo` | `ReplyToSchema` | default undefined |
| `attachments` | `[AttachmentSchema]` | default undefined |
| `reactions` | `Schema.Types.Mixed` | default undefined |
| `mentions` | `[String]` | default undefined |
| `sessionDate` | `Date` | — |
| `timestamp` | `Date` | default Date.now |

### Indexes

- `{ workshopId: 1, timestamp: 1 }` (L135)
- `{ workshopId: 1, sessionDate: 1, timestamp: 1 }` (L137)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `IWebinarReplyTo` | interface | Snapshot of the message being replied to. | 9 |
| `IWebinarAttachment` | interface | A file shared in chat. | 21 |
| `WebinarReactions` | type | Emoji reactions on a message, stored as emoji -> userIds. | 35 |
| `IWebinarMessage` | interface |  | 37 |
| `WebinarMessage` | model | `model<IWebinarMessage>( "WebinarMessage", WebinarMessageSchema )` | 139 |

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
