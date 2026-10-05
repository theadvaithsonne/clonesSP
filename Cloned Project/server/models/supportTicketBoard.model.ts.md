# `server/models/supportTicketBoard.model.ts`

> Singleton Mongoose model storing the coordinates of the one shared Taskroom "Garage Support" board that every support ticket is mirrored onto.

**Kind:** Mongoose model · **Lines:** 49

## Purpose
Every support ticket is also posted as an unassigned card on a single shared Taskroom board. Taskroom v2 is an external service. This lets the support team work tickets from the taskroom they already use instead of a separate console. This document records where that board lives (workspace, space, room, stage) and whose Taskroom account acts on it. There is only ever one document, keyed by `key: "support"`.

## How it works
- The board is provisioned lazily. The first ticket creates the workspace, space and room in Taskroom and caches the ids here. Later tickets reuse them.
- `status` (`provisioning` default, `ready`, `failed`; indexed) prevents two tickets racing to provision at the same time. `lastError` records why provisioning failed, and `provisionedAt` records when it succeeded.
- An admin can instead pick an existing board on the Support Chats page. `selectedBy` and `selectedAt` record that choice, along with `workspaceName` and `roomName`.
- Fields: `key` (required, unique, default `"support"`), `ownerUserId` -> `User` (the Garage user whose Taskroom account is used), `orgId` -> `Organization`, `workspaceId`, `workspaceName`, `spaceId`, `roomId`, `roomName`, `selectedBy`, `selectedAt`, `stageId` (the column new ticket cards land in), `status`, `lastError`, `provisionedAt`.
- `timestamps: true`. The collection name is explicitly `support_ticket_board`.
- The service can also take the owner, org, room and stage from env vars (`SUPPORT_TICKET_TASKROOM_OWNER_EMAIL`, `SUPPORT_TICKET_TASKROOM_ORG_ID`, `SUPPORT_TICKET_TASKROOM_ROOM_ID`, `SUPPORT_TICKET_TASKROOM_STAGE_ID`), and `SUPPORT_TICKET_TASKROOM_DISABLED=true` turns mirroring off. See `server/services/supportTicketTaskroom.ts`.

## Exports
- `SupportTicketBoard` - Mongoose model `"SupportTicketBoard"` bound to `support_ticket_board`.

## Interfaces
- **Database:** `SupportTicketBoard` (collection `support_ticket_board`) - read with `findOne({ key: "support" })` and upserted with `findOneAndUpdate`.
- **External services:** the stored ids refer to objects in the external Taskroom API.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/supportTicketTaskroom.ts`, which provisions or selects the board and posts ticket cards onto it.

## Notes
- Keep it a singleton. Code always looks up `key: "support"`, so a second document with a different key would be ignored.
