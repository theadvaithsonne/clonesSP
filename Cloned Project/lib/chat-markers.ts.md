# `lib/chat-markers.ts`

> Encodes and parses "rich" chat message types (location, contact, GIF/sticker and slash-command cards for tasks, polls, meetings, deals, approvals, documents and shared items) as a marker prefix plus JSON inside a message's plain `text` field.

**Kind:** frontend library · **Lines:** 338

## Purpose
Chat messages on the backend have only a plain-text `text` field. To send a location pin, a contact card, a GIF or an interactive card created from a slash command without changing the backend schema, the sender writes `"[garage-xxx]" + JSON.stringify(data)` into `text`. Every renderer (DMs, group chat, webinar chat, conference chat, chat previews) calls `parseMarker` and shows a card instead of raw text. This file defines the markers, the payload types and the encode/parse functions so all of them agree.

## How it works
### Markers
| Constant | Prefix | Card |
|---|---|---|
| `LOC_MARKER` | `[garage-location]` | map pin |
| `CONTACT_MARKER` | `[garage-contact]` | person card |
| `GIF_MARKER` | `[garage-gif]` | GIF or sticker |
| `TASK_MARKER` | `[garage-task]` | task (Taskrooms) |
| `POLL_MARKER` | `[garage-poll]` | poll |
| `MEET_MARKER` | `[garage-meet]` | meeting / room booking |
| `DEAL_MARKER` | `[garage-deal]` | CRM deal |
| `APPROVAL_MARKER` | `[garage-approval]` | approval request |
| `DOC_MARKER` | `[garage-doc]` | document |
| `SHARE_MARKER` | `[garage-share]` | shared course / webinar / product |

### Payload types (main fields)
- `LocationData` - `lat`, `lng`, optional `label`.
- `ContactData` - `id`, `name`, optional `email`, `avatar`, `role`.
- `GifData` - `url`, optional `w`, `h`, `title`, `kind: "gif" | "sticker"`, `source` (Tenor's permanent share URL).
- `TaskCardData` - `taskId`, `title`, legacy `status: TaskStatus` (`todo | inprogress | done`), optional assignee, `dueDate`, `priority: TaskPriority` (`low | medium | high | urgent`), `description`. Taskrooms integration fields `taskroomId`, `taskroomName`, `stages: TaskStageRef[]`, `currentStageId` let the card deep-link and change stage from chat. Multi-assignee fields `taskIds`, `assignees` (one task per member in group chats, actions fan out across them) and `availableAssignees` (a roster snapshot at send time for the Reassign popover).
- `PollCardData` - `pollId`, `question`, `options[{ id, text }]`, optional `isAnonymous`, `isMultiChoice`, `deadline`, `createdBy`.
- `MeetCardData` - `eventId`, `title`, `startTime`, `endTime`, `invitees`. Newer cards carry a real room booking (`orgId`, `roomId` -> `/meet/conference/<orgId>/<roomId>`, `roomName`, `bookingId`, `description`); old cards use the legacy `joinCode`.
- `DealCardData` - `dealId`, `name`, `stage: DealStage` (`lead | qualified | proposal | won | lost`), optional `value`, `currency`, owner, `nextFollowUp`.
- `ApprovalCardData` - `approvalId`, `title`, `approvers`, `requesterId`, optional `description`, `requesterName`, `deadline`. (`ApprovalDecision` = `pending | approved | rejected` is exported for consumers.)
- `DocCardData` - `docId`, `name`, `url`, optional `size`, `mimeType`, `thumbnail`.
- `ShareCardData` - `kind: ShareKind` (`course | webinar | product`), `itemId`, `title`, `url`, optional `image`, `price`, `currency`, `description`.

### Encoding
Each `encodeX(data)` returns `MARKER + JSON.stringify(data)`.

### Parsing
`parseMarker(text)` trims the text, then walks a fixed `SPECS` table. For the first marker the text starts with, it JSON-parses the remainder and runs that spec's validator (minimum required fields, for example `lat`/`lng` numbers for location, `pollId` + `question` + at least two options for polls, `docId` + `name` + string `url` for docs). Valid -> `{ type, data, raw }` (`ParsedMarker`, a discriminated union on `type`); malformed JSON or failed validation -> `null` (no other marker is tried once a prefix matched). Text without a marker -> `null`. `hasMarker(text)` is `parseMarker(text) !== null`.

### Conference sentinel
`OFFICE_CONFERENCE_ROOM_ID = "office"` is a sentinel room id meaning the office's default conference room (`hq-room:<orgId>`) when no founder-created named room exists, so any member can book and join it from `/meet`. It lives here because meet cards and `ConferenceCallStandalone` both use it.

## Exports
- Marker constants: `LOC_MARKER`, `CONTACT_MARKER`, `GIF_MARKER`, `TASK_MARKER`, `POLL_MARKER`, `MEET_MARKER`, `DEAL_MARKER`, `APPROVAL_MARKER`, `DOC_MARKER`, `SHARE_MARKER`.
- `OFFICE_CONFERENCE_ROOM_ID = "office"`.
- Types: `LocationData`, `ContactData`, `GifData`, `TaskStatus`, `TaskPriority`, `TaskStageRef`, `TaskAssigneeRef`, `TaskCardData`, `PollCardData`, `MeetCardData`, `DealStage`, `DealCardData`, `ApprovalDecision`, `ApprovalCardData`, `DocCardData`, `ShareKind`, `ShareCardData`, `ParsedMarker`.
- Encoders: `encodeLocation`, `encodeContact`, `encodeGif`, `encodeTask`, `encodePoll`, `encodeMeet`, `encodeDeal`, `encodeApproval`, `encodeDoc`, `encodeShare` - each `(data) => string`.
- `parseMarker(text: string | null | undefined): ParsedMarker | null`
- `hasMarker(text: string | null | undefined): boolean`

## Dependencies
None.

## Used by
- Chat UI: `components/chat/ChatPreviewText.tsx`, `ContactShareButton.tsx`, `GifPicker.tsx`, `LocationShareButton.tsx`, `MessageContent.tsx`, `SlashCommandCards.tsx`, `SlashCommandForm.tsx` (in `components/chat/`).
- Chat pages: `components/dashboard/DMPage.tsx`, `GlobalDMPage.tsx`, `GroupChatPage.tsx`.
- Webinar chat: `components/webinar/ChatPanel.tsx`, `GifBubble.tsx`, `WebinarChatReplay.tsx`.
- Conference: `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx`.
- Libraries: `lib/hooks/useSlashCardSync.ts`, `lib/slash-state.ts`.

## Notes
- Card payloads are stored verbatim in message text, so anything placed in them (names, URLs, assignee lists) is visible to every participant and to any client that reads raw messages. Validators check only presence of a few fields; renderers must still treat URLs and strings as untrusted.
- Old clients that do not know a marker show the raw `[garage-xxx]{...}` text.
- Card state that changes after sending (poll votes, approval decisions, task stage) is not in the message text; consumers such as `lib/hooks/useSlashCardSync.ts` sync it separately.
