# `server/models/groupAiTask.model.ts`

> Mongoose model recording each Taskroom task created from a group chat message, by the AI or by hand, and guarding against filing the same item twice.

**Kind:** Mongoose model · **Lines:** 57

## Purpose
When a group is linked to a Taskroom board, `server/services/groupTaskAuto.ts` classifies incoming messages and files tasks on the board. This collection is the local record of each such task: which message produced it, which messages fed it (including screenshots), who reported it and the Taskroom task id. It also covers tasks a member adds manually (`groupTaskManual.ts`).

## How it works
Fields:
- `groupId` (ref `Group`, required), `orgId` (ref `Organization`).
- `messageId` (ref `GroupMessage`, required) - the trigger message.
- `itemIndex` (default 0) - position among the tasks extracted from that message (one message can yield several).
- `sourceMessageIds[]` - every message that fed the task, including image-only messages from the same sender whose screenshots were attached; an image listed here is never attached to a second task.
- `fromUserId` (reporter), `taskroomTaskId` (required), `roomId`, `priority`, `confidence`, `title`, `attachmentCount`.
- `source` - `"ai"` (default, so pre-existing rows read as AI) or `"manual"`. A manual row uses a synthetic `messageId` that points at no real message, which keeps the unique guard working without a migration.
- Only `createdAt` timestamps.

Indexes:
- Unique `{ messageId, itemIndex }` - duplicate guard if capture runs again.
- `{ groupId, createdAt: -1 }` - recent tasks for duplicate-detection context.
- `{ groupId, fromUserId, createdAt: -1 }` - "screenshot sent right after the text" attach rule.
- `{ taskroomTaskId }` and `{ sourceMessageIds }` - removal and follow-up lookups.

## Exports
- `GroupAiTask` - model `"GroupAiTask"` (default collection `groupaitasks`), untyped, guarded against re-registration.

## Interfaces
- **Database:** collection `groupaitasks` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/groupTaskAuto.ts`, `groupTaskManual.ts`, `groupTaskRemoval.ts`, `supportChatTaskroom.ts`, `supportTicketSuggest.ts`.

## Notes
- `source` is a free string in the schema (no enum); only `"ai"` and `"manual"` are described.
