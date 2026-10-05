# `server/models/group.model.ts`

> Mongoose model for group chats, including admin controls, invite links, per-user support chats and an optional linked Taskroom board.

**Kind:** Mongoose model · **Lines:** 153

## Purpose
Groups are the multi-person chat rooms of the app (messages live in `GroupMessage`). The same collection also holds "support chats" (one per user, with their upline and all active garage admins) and records a group's link to a Taskroom board, which is used to turn chat messages into tasks with AI. Many services depend on it: chat routes, the Socket.IO server, support chat, the Taskroom sync and member cleanup.

## How it works
**Core group:**
- `name` (required), `description`, `picture` (URL), `createdBy` (ref `User`, required).
- `members[]` - `{ userId, role: "admin" | "member", joinedAt, lastReadAt }` (no `_id`; `lastReadAt` defaults to the epoch for unread counts).
- `agentMembers[]` - virtual agent ids such as `"openclaw_agent_abc"`.
- `orgId` (ref `Organization`, required). Groups without it are invisible to org-scoped queries; legacy docs are fixed by `server/scripts/backfill-group-orgid.ts`.

**Admin controls:** `broadcastOnly`, `adminOnlyFiles`, `messageRetentionDays` (0 = keep forever), `inviteCode` and `inviteExpiry`. `inviteCode` has no default so groups without a link simply lack the key.

**Support chats** (`services/supportChat.ts`): `kind` (only `"support"`, deliberately no default so ordinary groups are unchanged), `supportUserId` (the member it exists for), `supportUplineId` (upline at last sync, so changes can swap them), `supportAgentUserId` (User account of the assigned support admin), `supportLastMessage` (`text`, `from`, `at`, `hasAttachments`, `fromStaff` - false means awaiting a staff reply), and `supportActivityAt` (sort key). The last message is denormalised because staff sit in every support chat and the lists need to sort and flag "unanswered" cheaply.

**Taskroom link** (`taskroom`, no default; `services/groupTaskroom.ts`, `groupTaskAuto.ts`):
- `enabled` (AI task capture on/off; member sync runs regardless), `status` (`active` | `broken` - board gone or nobody can act, relink needed), `mode` (`new-workspace` | `new-board` | `existing-board`).
- Taskroom ids: `workspaceId`, `workspaceName`, `spaceId`, `roomId`, `roomName`, `stageId` (the first "tostart" column new tasks land in).
- `linkedBy`, `linkedAt`, `actorOrgId` (support chats only: the org Taskroom calls are made in, since the chat's own org is the customer's).
- `members[]` - `{ userId, taskroomUserId (Taskroom's own tr2_user id), addedBySync, status: synced|failed, error, syncedAt }`. `addedBySync` is a removal guard: the sync only removes people it added itself.
- `lastSyncAt`, `lastError`, `lastErrorAt`.
- `supportTaskroomOwn` - support chats: true when the chat has its own board, otherwise it files onto the shared support board (`supportChatTaskroom.ts`).

**Indexes:** `members.userId`; `orgId`; partial unique `{ supportUserId }` where `kind: "support"` (one support chat per user); `{ kind, supportActivityAt: -1 }`; partial unique `{ inviteCode }` where it is a string. The comment explains `sparse` was not enough because literal `null` values would still collide (E11000).

## Exports
- `Group` - model `"Group"` (default collection `groups`), untyped, guarded against re-registration.

## Interfaces
- **Database:** collection `groups` (read/write).
- **External services (via the services that use these fields):** Taskroom, an external service at uatapi.garage.app per project notes.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/index.ts`, `server/realtime/socket.ts`, routes `chat.ts` (`/chat`), `groups.ts` (`/groups`), `garageAdminSupportChats.ts` (`/garage-admin`), services `groupSystemMessage.ts`, `groupTaskAuto.ts`, `groupTaskManual.ts`, `groupTaskRemoval.ts`, `groupTaskroom.ts`, `memberCleanup.service.ts`, `supportChat.ts`, `supportChatTaskroom.ts`, `supportTicketAuto.ts`, `supportTicketSuggest.ts`, the test `server/services/__tests__/groupTaskroom.test.ts`, and manual scripts `server/scripts/backfill-support-chats.ts`, `server/scripts/fix-groups-invite-index.ts` (18 importers).

## Notes
- Several fields intentionally have `default: undefined` or no default so older clients receive byte-identical payloads for ordinary groups; do not add defaults casually.
- `fix-groups-invite-index.ts` exists because the invite-code index used to be a plain sparse unique index.
