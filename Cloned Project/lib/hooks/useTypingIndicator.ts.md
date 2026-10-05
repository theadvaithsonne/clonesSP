# `lib/hooks/useTypingIndicator.ts`

> Shared WhatsApp-style "typing..." hook for group, DM and global-DM chats: announces my typing over Socket.IO with throttled pings and tracks other typists with auto-expiry.

**Kind:** React hook · **Lines:** 186

## Purpose
All three chat surfaces need the same typing behaviour, differing only in event names and the payload that identifies the conversation. This hook is parameterised by those, so each page supplies `startEvent`/`stopEvent`, a `payload` naming the chat, and an `accepts` filter for incoming events.

## How it works
- **Timing constants:** `TYPING_PING_MS = 3000` (re-announce while still typing), `TYPING_IDLE_MS = 3000` (pause that counts as stopping), `TYPING_EXPIRY_MS = 6000` (receivers drop a typist this long after their last announcement, so a lost stop event cannot leave "typing..." stuck).
- **Receiving (others typing):** when `enabled`, an effect calls `connectSocket()` and listens for `startEvent`/`stopEvent`. Events are passed to `accepts` (held in a ref, so new closures do not resubscribe) because one socket is in the rooms of every chat it opened. Start -> `upsertTypingUser` adds the user if new and (re)arms a per-user expiry timer in `timersRef`; stop -> `removeTypingUser` clears the timer and removes them.
- **Sending (me typing):** `handleTyping(value)` is called with the textbox's text on each change. Empty/whitespace text calls `stopTyping()`. Otherwise it emits `startEvent` with the current payload on the first keystroke or when `TYPING_PING_MS` has passed since the last ping, and resets an idle timer that calls `stopTyping` after `TYPING_IDLE_MS`. My own typing state lives in refs (`isTypingRef`, `lastPingRef`, `idleTimeoutRef`) to avoid re-rendering on every keystroke.
- **`stopTyping()`** clears the idle timer and, only if currently typing, emits `stopEvent` with the payload. Pages also call it on send.
- **Chat switch / unmount:** the chat's identity is `JSON.stringify(payload)` (`chatKey`). When it changes, typists are cleared; the cleanup clears all expiry timers and the idle timer and emits `stopEvent` to the *previous* chat's payload if I was typing there.
- **Auto-scroll:** when someone starts typing and `bottomRef` is given, it finds the nearest `.overflow-y-auto` ancestor and scrolls the bottom element into view only if the reader is within 160px of the bottom.

## Exports
- `useTypingIndicator({ startEvent, stopEvent, payload, accepts, enabled = true, bottomRef? })` - returns `{ typingUsers, handleTyping, stopTyping, removeTypingUser }`. `enabled` is off for chats with no human on the other end (AI agents); `removeTypingUser` lets a page drop a typist immediately, e.g. when their message arrives.
- `TYPING_PING_MS`, `TYPING_IDLE_MS`, `TYPING_EXPIRY_MS` - the timing constants above.
- `type TypingUser` - `{ userId, userName }`.

## Interfaces
- **Socket.IO events** (event names supplied by callers; relayed by `server/realtime/socket.ts`):
  - DM (`DMPage.tsx`): emits/listens `dm:typing` / `dm:stopTyping`, payload `{ otherId }`.
  - Global DM (`GlobalDMPage.tsx`): `global-dm:typing` / `global-dm:stopTyping`, payload `{ otherId }`.
  - Group (`GroupChatPage.tsx`): `group:typing` / `group:stopTyping`, payload `{ groupId }`.
  Incoming events carry at least `userId` and optionally `userName`.
- **Background work:** one `setTimeout` per remote typist plus one idle timer for the local user.

## Dependencies
- **Internal:** `lib/socket.ts` - `connectSocket()` (ensures the socket is connected before listening) and `getSocket()` (for emits).
- **Packages:** `react` - `useState`, `useEffect`, `useRef`, `useCallback`, `RefObject` type.

## Used by
- `components/dashboard/DMPage.tsx`
- `components/dashboard/GlobalDMPage.tsx`
- `components/dashboard/GroupChatPage.tsx`

## Notes
- `handleTyping` returns early when `enabled` is false, but the chat-switch cleanup still runs regardless.
- The auto-scroll relies on the message list scroller having the Tailwind class `overflow-y-auto`; renaming that class silently disables it.
