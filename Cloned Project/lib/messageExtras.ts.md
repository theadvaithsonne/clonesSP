# `lib/messageExtras.ts`

> Client-only, localStorage-backed store for per-message reactions, stars and pins, plus helpers for forwarded-message markers and message-edit limits.

**Kind:** frontend library · **Lines:** 230

## Purpose
The chat screens (DMs, global DMs, group chat) offer WhatsApp-style message actions. Reactions, starring and pinning are kept on the client only, in this small external store, rather than on the backend. The file also centralises two chat conventions: how forwarded messages are marked in their text, and the rules for when a user may edit a message.

## How it works

### Extras store (L1-L139)
- State shape: `reactions` (messageId -> emoji -> userIds), `starred` (messageId -> true), `pinned` (messageId -> true).
- Loaded once at module import from localStorage key `garage_message_extras_v1` (empty on the server or on parse failure).
- Every mutation replaces `state` immutably, writes it back (`persist`, errors ignored) and notifies subscribers (`emit`).
- A `storage` event listener reloads the store when another tab changes the same key, so tabs stay in sync.
- `toggleReaction(messageId, emoji, userId)` enforces **one reaction per user per message**: the user is removed from every emoji on that message; if they clicked the emoji they already had, that is a removal, otherwise they are added to the new emoji. Empty emoji lists and empty messages are deleted.
- `getReactions` returns a frozen shared empty object when there are none, keeping snapshot identity stable for `useSyncExternalStore`.
- `toggleStar`, `togglePin`, `isStarred`, `isPinned`, `pinnedIds`, `starredIds` and `removeMessage` (clears all extras for a deleted message, no-op if nothing to remove) complete the API.

### React hooks (L141-L168)
- `useMessageExtras(messageId)` subscribes three times via `useSyncExternalStore` and returns `{ reactions, starred, pinned }`, with server snapshots of empty/false.
- `usePinnedIds()` uses a comma-joined string as the snapshot (so it is stable) and splits it back into an array.

### Forwarded marker (L170-L182)
Forwarded messages are sent with the text prefix `FORWARDED_PREFIX` (`"↪ Forwarded\n"`). `isForwardedText` detects it and `stripForwarded` removes it for display.

### Edit rules (L184-L229)
- `EDIT_WINDOW_MS` = 15 minutes, `MAX_EDITS` = 5.
- Edit counts per message are kept in localStorage key `garage_message_edit_counts_v1`; `getEditCount` reads and `bumpEditCount` increments.
- `canEditMessage(msg, isMine)` returns `{ ok: false, reason }` for "Not your message", "Unknown time" (unparseable `createdAt`), "Edit window closed" or "Edit limit reached"; otherwise `{ ok: true }`.

## Exports
- `messageExtras` - store object: `subscribe`, `getReactions`, `toggleReaction`, `isStarred`, `toggleStar`, `isPinned`, `togglePin`, `pinnedIds`, `starredIds`, `removeMessage`.
- `useMessageExtras(messageId)` - `{ reactions, starred, pinned }` for one message.
- `usePinnedIds(): string[]` - all pinned message ids.
- `FORWARDED_PREFIX`, `isForwardedText(text)`, `stripForwarded(text)` - forwarded-message marker helpers.
- `EDIT_WINDOW_MS`, `MAX_EDITS`, `getEditCount(messageId)`, `bumpEditCount(messageId)`, `canEditMessage(msg, isMine)` - edit constraints.

## Interfaces
- **Browser storage / cookies:** localStorage `garage_message_extras_v1` (reactions/stars/pins) and `garage_message_edit_counts_v1` (edit counts).

## Dependencies
- **Internal:** none.
- **Packages:** `react` - `useSyncExternalStore`.

## Used by
- `components/chat/MessageActions.tsx`
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

## Notes
- Reactions, stars, pins and edit counts are per-browser only: other participants never see a user's reactions through this store, and clearing site data loses them. Edit limits are therefore enforceable only on the client and can be bypassed.
- The `import { useSyncExternalStore }` statement sits mid-file (L141); it is hoisted by ES modules so it works, but it is unusual.
- Pinned ids are joined with commas, so a message id containing a comma would break `usePinnedIds` (Mongo ObjectIds do not).
