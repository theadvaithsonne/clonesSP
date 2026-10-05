# `lib/admin-api/support-chats.ts`

> Typed garage-admin client for the Support Chats console: chat list and detail, message history, replies with attachments, reactions, edits and deletes, members, typing, read state, translation, raising tickets from a chat (with AI triage), and linking a chat to Taskroom boards.

**Kind:** frontend library · **Lines:** 509

## Purpose
Every member has a support chat: a group chat between the member, possibly their upline, and Garage staff. This module lets garage admins handle those chats from the admin console instead of the app. Every call goes through `garageAdminApi`, which attaches the admin JWT and throws `Error(message)` on any non-2xx response. Callers catch the error and show `err.message` as-is; it is the backend's own text and is written for display (for example the 409 "no app account" message). Responses use the `{ success, data }` envelope, and each helper returns `.data`.

## How it works
### Types (L14-L139)
- **People.** `SupportPerson` (id, name, email, phone, picture, country) and `SupportAgent`.
- **List rows.** `SupportChatListItem` has: `groupId`, `name`, `user` (**null when the member's account was deleted**, so every consumer must check), `upline`, `assignedAgent`, `lastMessage` (text, sender, whether the sender is staff, attachments, time), `awaitingReply`, `unread`, `memberCount`, `activityAt`. `SupportChatListData` adds paging and `counts` for each filter tab.
- **Chat detail.** `SupportChatDetails` has:
  - `me`, the calling admin's own app user id; compare it with `message.from` to right-align the admin's messages;
  - the member with city, state and join date (also null if deleted), `uplineId`, the assigned agent;
  - `members[]`, each with flags `isMember`, `isUpline`, `isStaff`.
- **Messages.** `SupportMessage` can be an ordinary message (`from`, `text`, attachments, mentions, `replyTo`, `reactions` map, edit/delete timestamps) or a system row (`type: "system"`, `event`, `actorId`, no `from`). `SupportMessagesData` returns the `items`, `readUpTo` (the member's last-read time, which drives the ✓ / ✓✓ marks), `nextCursor` for loading older messages, and a `users` lookup keyed by id.

### Translation languages (L141-L180)
`SUPPORT_LANGS` lists English, all 22 scheduled Indian languages, Spanish, French, Arabic and Chinese, each with a native-script label. Right-to-left scripts are marked `rtl`. The list must match `TRANSLATE_LANGUAGES` in the backend's `messageTranslation` service, which rejects any other code. `SupportLang` is the union of those codes.

### Chat calls (L182-L349)
`BASE = "/garage-admin/support-chats"`. `qs()` skips undefined and empty values.
- `listSupportChats({ filter: "all" | "unanswered" | "mine", q, page, limit })` - the chat list.
- `getSupportChat(groupId)` - chat detail.
- `getSupportMessages(groupId, { cursor, limit })` - message history, older pages via `cursor`.
- `sendSupportReply(groupId, { text?, replyTo?, attachments?, mentions? })` - returns the created message.
- `uploadSupportAttachment(file)` - posts `FormData` (field `file`) through `garageAdminApi`; `api()` leaves the multipart content type to the browser. It returns an `OutgoingAttachment` (`fileUrl` plus optional name, size, type and key) to pass to `sendSupportReply`.
- `reactToSupportMessage(groupId, messageId, emoji)` - toggles the admin's reaction and returns the full reaction map.
- `editSupportMessage(groupId, messageId, text)` - edits the admin's own message only.
- `deleteSupportMessage(groupId, messageId)` - deletes a message for everyone; staff can remove any message in a support chat.
- `addSupportMember(groupId, userId)` - adds an app user; safe to repeat.
- `getSupportTyping(groupId)` - who is typing now. This is polled over HTTP; it is not a Socket.IO event.
- `markSupportChatRead(groupId)` - marks the chat read.
- `translateSupportMessages(groupId, { messageIds, lang })` - returns a `translations` map keyed by message id.
- `ensureSupportChat(userId)` - creates the member's support chat if needed and returns its `groupId`.

### Tickets from chats (L351-L408)
- `createTicketFromChat(groupId, { sourceMessageId?, subject?, description?, priority? })` - one open ticket per chat. If one is already open, the backend returns it with `existed: true` instead of creating a duplicate.
- `getTicketSuggestion(groupId)` - triage on whether the chat should become a ticket. The backend asks an AI model and falls back to keyword rules (`source: "ai" | "rules"`). A failure comes back as `{ suggest: false }`, not as a useful error. The suggestion may include `openTicketId`.

### Taskroom (L418-L503)
A chat files tasks onto its own Taskroom board if an admin linked one; otherwise onto the shared support board. Tasks are created unassigned and are assigned in Taskroom.
- `getSupportChatTaskroom(groupId)` - returns `{ own, board }`.
- `linkSupportChatTaskroom(groupId, workspaceId, roomId)` (`PUT`) and `unlinkSupportChatTaskroom(groupId)` (`DELETE`).
- `listSupportChatTasks(groupId)` - returns `{ tasks, live }`.
- `addSupportChatTask(groupId, { title?, description?, priority?, sourceMessageId? })` - with `sourceMessageId`, the title, body and files default to that message.
- `removeSupportChatTask(groupId, taskId)`.
Task priority values are `low | normal | high | urgent`, unlike ticket priority (`medium` instead of `normal`).

## Exports
- Types:
  - chats and people: `SupportChatFilter`, `SupportPerson`, `SupportAgent`, `SupportLastMessage`, `SupportChatListItem`, `SupportChatCounts`, `SupportChatListData`, `SupportChatMember`, `SupportChatDetails`
  - messages: `SupportAttachment`, `SupportMessage`, `SupportMessageUser`, `SupportMessagesData`, `OutgoingAttachment`
  - translation: `SupportLang`, `SupportTranslateData`
  - tickets: `CreateTicketResult`, `TicketSuggestion`
  - Taskroom: `SupportChatTaskroom`, `SupportChatTask`, `SupportTaskPriority`
- `SUPPORT_LANGS` - the translation language list.
- Chat functions:
  - read: `listSupportChats`, `getSupportChat`, `getSupportMessages`, `getSupportTyping`
  - write: `sendSupportReply`, `uploadSupportAttachment`, `reactToSupportMessage`, `editSupportMessage`, `deleteSupportMessage`, `addSupportMember`, `markSupportChatRead`, `translateSupportMessages`, `ensureSupportChat`
- Ticket functions: `createTicketFromChat`, `getTicketSuggestion`.
- Taskroom functions: `getSupportChatTaskroom`, `linkSupportChatTaskroom`, `unlinkSupportChatTaskroom`, `listSupportChatTasks`, `addSupportChatTask`, `removeSupportChatTask`.

## Interfaces
- **Backend endpoints called** (`server/routes/garageAdminSupportChats.ts`, mounted at `/garage-admin`):
  - Chats and messages:
    - `GET /backend/garage-admin/support-chats?filter&q&page&limit` - chat list
    - `GET /backend/garage-admin/support-chats/:groupId` - chat detail
    - `GET /backend/garage-admin/support-chats/:groupId/messages?cursor&limit` - message history
    - `POST /backend/garage-admin/support-chats/:groupId/messages` - send a reply
    - `PATCH /backend/garage-admin/support-chats/:groupId/messages/:messageId` - edit
    - `DELETE /backend/garage-admin/support-chats/:groupId/messages/:messageId` - delete
    - `POST /backend/garage-admin/support-chats/:groupId/messages/:messageId/react` - toggle reaction
    - `POST /backend/garage-admin/support-chats/upload` - multipart attachment upload
  - Members and chat state:
    - `POST /backend/garage-admin/support-chats/:groupId/members` - add member
    - `GET /backend/garage-admin/support-chats/:groupId/typing` - who is typing
    - `POST /backend/garage-admin/support-chats/:groupId/read` - mark read
    - `POST /backend/garage-admin/support-chats/:groupId/translate` - translate messages
    - `POST /backend/garage-admin/support-chats/ensure/:userId` - create chat if needed
  - Tickets:
    - `POST /backend/garage-admin/support-chats/:groupId/ticket` - raise a ticket
    - `GET /backend/garage-admin/support-chats/:groupId/ticket-suggestion` - AI/rules triage
  - Taskroom:
    - `GET` / `PUT` / `DELETE /backend/garage-admin/support-chats/:groupId/taskroom` - board link
    - `GET` / `POST /backend/garage-admin/support-chats/:groupId/taskroom/tasks` - list or add tasks
    - `DELETE /backend/garage-admin/support-chats/:groupId/taskroom/tasks/:taskId` - remove task
- **Backend access rule:** the route is gated on the grantable `support_chats` admin page (`server/config/adminPages.ts`). `view` lets an admin read; `manage` lets them reply, tag, delete and add tasks. The App Store review account is refused.
- **Database (indirect):** `Group`, `GroupMessage`, `User`, `Ticket` on the backend. Attachments are stored in S3 (in-memory multer, 50 MB limit).
- **Backend services involved:** `server/services/messageTranslation.ts` (translation), `server/services/supportTicketSuggest` (ticket triage), `server/services/supportChat` (creating chats and posting as staff), and Taskroom board integration.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `components/garage-admin/SupportChatTaskroomPanel.tsx`
- `components/garage-admin/SupportChatsConsole.tsx`

## Notes
- Always check for a null `user` on list items and chat details (deleted accounts).
- Keep `SUPPORT_LANGS` in step with the backend list, or translation requests are rejected.
- The source comment points to `garagenew-backend src/routes/garageAdminSupportChats.ts`; in this merged project it is `server/routes/garageAdminSupportChats.ts`.
