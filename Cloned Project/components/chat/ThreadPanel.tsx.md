# `components/chat/ThreadPanel.tsx`

> Side panel that shows one group-chat message's thread, streams new replies over Socket.IO, lets the user reply, and toggles the thread's "resolved" flag.

**Kind:** React component · **Lines:** 385

## Purpose
Group chats support Slack-style threads: a reply carries `threadId` = the parent message id. When a user opens a thread from `GroupChatPage`, this panel appears on the right (full width on mobile, 380px from `md` up). It loads the parent and its replies over REST, then keeps them live through socket events, and reports reply-count and resolved-state changes back to the parent page so the main message list can update its thread summary.

## How it works
- **Initial load:** on open (and whenever `groupId` or the parent id changes) it calls `GET /backend/groups/:groupId/thread/:messageId`, which returns `{ parent, items }`. The server's copy of the parent replaces the prop copy, and the view scrolls to the bottom. A `cancelled` flag ignores late responses after the panel changes.
- **Live updates:** connects with `connectSocket()` and listens for:
  - `group:thread-reply` - added only if it matches this group and thread. A reply with a known `tempId` replaces the optimistic copy; duplicates by `_id` are ignored.
  - `group:thread-update` - updates `replyCount` / `threadResolved` on the parent and forwards `replyCount`, `threadResolved`, `lastThreadReply` and `threadParticipants` to `onParentUpdated`.
- **Sending a reply:** Enter (without Shift) or the Send button. It appends an optimistic message with a `tmp_thread_<timestamp>` id, clears and shrinks the textarea, then emits `group:message` with `{ groupId, text, tempId, threadId }` and an ack callback. On `ack.ok` the optimistic message is swapped for `ack.msg`; otherwise it is removed and the error is logged (no toast is shown).
- **Resolve toggle:** `PATCH /backend/groups/:groupId/thread/:messageId/resolve` returns `{ ok, threadResolved }`; the button turns green ("Resolved") and the new value is passed to `onParentUpdated`.
- **Rendering:** the parent is drawn first with a divider, then a reply count and the replies. Agent (AI) messages, identified by `agentMeta`, get a violet initial avatar and the agent's name; human messages use `Avatar` with the sender's picture from `userMap`. The sender label is "You" for the current user, else name, email, or the first 6 chars of the user id. Only `text` is rendered; attachments and mentions in the type are not displayed here.
- The textarea auto-grows up to 96px.

## Exports
- `default ThreadPanel({ groupId, parentMessage, userMap, onClose, onParentUpdated? })`
  - `groupId: string` - group the thread belongs to.
  - `parentMessage: ThreadMsg` - the root message (id, text, sender, replyCount, threadResolved, ...).
  - `userMap: Record<string, MemberLite>` - member lookup for names/avatars.
  - `onClose()` - close the panel.
  - `onParentUpdated?(update)` - notified of `replyCount`, `threadResolved`, `lastThreadReply`, `threadParticipants` changes.

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/groups/:groupId/thread/:messageId` - parent and replies.
  - `PATCH /backend/groups/:groupId/thread/:messageId/resolve` - toggle resolved.
- **Socket.IO events:** emits `group:message` (with `threadId`, acked); listens for `group:thread-reply`, `group:thread-update` (both broadcast by `server/realtime/socket.ts` to the `group:<id>` room).

## Dependencies
- **Internal:** `lib/api.ts` - `api()` REST wrapper; `lib/auth.ts` - `getToken`, `getUserIdFromToken`; `lib/socket.ts` - `connectSocket`, `getSocket`; `components/ui/avatar.tsx`, `components/ui/button.tsx`.
- **Packages:** `react`, `lucide-react` (icons).

## Used by
- `components/dashboard/GroupChatPage.tsx`

## Notes
- `getUserIdFromToken()!` is non-null asserted; the panel assumes a signed-in user.
- If the socket ack never arrives, `isSending` stays true and the Send button remains disabled.
- `onParentUpdated` is an effect dependency; if the parent passes a new function each render, the socket listeners are re-registered each render.
