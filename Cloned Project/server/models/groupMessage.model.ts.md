# `server/models/groupMessage.model.ts`

> Mongoose model for messages in group chats, covering ordinary messages, system event pills, threads, reactions, attachments, agent replies and Taskroom task marks.

**Kind:** Mongoose model · **Lines:** 153

## Purpose
Every message posted in a `Group` (including support chats) is a `GroupMessage`. The schema is shared by the REST chat routes, the Socket.IO server, the support-chat service, translation, and the Taskroom/AI task pipeline, so its shape is effectively the wire format for group messages.

## How it works
**Attachments** (`AttachmentSchema`): `fileName`, `fileSize`, `fileType`, `fileUrl`, `fileKey` (S3 key), `uploadedAt`, plus optional media metadata kept identical to DM attachments so one renderer handles both: `durationMs`, `width`, `height`, `thumbnailUrl`, `waveform[]`.

**Ordinary message fields:** `groupId` (ref `Group`, required, indexed), `from` (ref `User`; optional so agent replies can omit it), `text` (optional so attachment-only messages work), `attachments[]`, `mentions[]`, `replyTo`, `agentMeta { agentId, agentName }`, `editedAt`, `readAt`, `deletedAt`, `reactions` (`Map<emoji, userId[]>`), `clientMsgId`.

**System events:** `type` (only `"system"`), `event` (one of `SYSTEM_EVENTS`), `actorId` (who did it; `from` stays unset), `targetIds[]`. Deliberately no default for `type`, so ordinary messages and all pre-existing rows have no `type` key and older clients get byte-identical payloads. `SYSTEM_EVENTS` covers membership changes (`group_created`, `member_added`, `member_removed`, `member_left`, `admin_promoted`, `admin_dismissed`), settings changes (`group_renamed`, `icon_changed`, `description_changed`, `retention_changed`) and Taskroom events (`taskroom_linked`, `taskroom_unlinked`, `ai_task_created`, `ai_task_removed`, `ai_task_assigned`, `ai_task_updated`, `manual_task_created`). These render as centred pills.

**Taskroom data:**
- `taskroom` (system pills only) - `{ taskId, roomId, spaceId, workspaceId, title }` so the client can open the board or task.
- `aiTasks[]` (ordinary messages the AI filed, and attached screenshot messages) - same shape; drives the "added to Taskroom" mark on the bubble. No default.

**Threads:** `threadId` (parent message, indexed), `threadResolved`, `replyCount`, `lastThreadReply { text, from, createdAt }`, `threadParticipants[]`.

Only `createdAt` timestamps (no `updatedAt`).

**Indexes:** `{ groupId, createdAt: -1 }` for paging and the per-group scan done by `/chat/search` (which uses a regex rather than a text index - see `message.model.ts`); partial unique `{ from, clientMsgId }` where `clientMsgId` is a string, for idempotent sends.

## Exports
- `GroupMessage` - model `"GroupMessage"` (default collection `groupmessages`), guarded against hot-reload `OverwriteModelError`.
- `SYSTEM_EVENTS` - readonly list of system event names.
- `SystemEvent` - union type of those names.

## Interfaces
- **Database:** collection `groupmessages` (read/write).

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/index.ts`, `server/realtime/socket.ts`, routes `chat.ts` (`/chat`), `groups.ts` (`/groups`), `garageAdminSupportChats.ts` (`/garage-admin`), services `groupSystemMessage.ts`, `groupTaskAuto.ts`, `groupTaskRemoval.ts`, `memberCleanup.service.ts`, `messageTranslation.ts`, `supportChat.ts`, `supportTicketSuggest.ts`, and the manual script `server/scripts/migrate-to-public-urls.ts` (13 importers).

## Notes
- Adding a system event requires adding it to `SYSTEM_EVENTS`; the runtime enum is built from that array.
- `readAt` is a single field, so it is not a per-member read receipt; per-member unread state lives in `Group.members[].lastReadAt`.
