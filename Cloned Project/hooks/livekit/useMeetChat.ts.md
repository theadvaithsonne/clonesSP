# `hooks/livekit/useMeetChat.ts`

> Client hook that wraps LiveKit's `useChat()` with open/close state and an unread-message counter for an in-meeting chat panel.

**Kind:** React hook · **Lines:** 59

## Purpose
Gives a meeting UI a single object for its chat sidebar: the message list, a send function, whether the panel is open and how many messages arrived while it was closed. It must run inside a `<LiveKitRoom>` provider because `useChat()` reads the room from React context. This is the original version; Garage's conference page uses `hooks/office/useMeetChat.ts`, which keeps messages in the app-wide `MeetingProvider` instead.

## How it works
- Pulls `chatMessages`, `send` and `isSending` from `useChat()` (LiveKit's DataChannel chat).
- Keeps `isOpen` and `unreadCount` in state, plus `prevCountRef` holding the last seen message count.
- An effect runs whenever the message count or `isOpen` changes: if the count grew while the panel is closed, the difference is added to `unreadCount`. The ref is then updated.
- `toggleChat()` flips `isOpen` and clears unread when opening; `openChat()` opens and clears; `closeChat()` only closes.
- `sendMessage(message)` ignores blank / whitespace-only text and otherwise awaits `send(message)`.
- Message history lives inside `useChat()`'s own state, so it is lost when the component unmounts.

## Exports
- `useMeetChat(): { chatMessages, sendMessage, isSending, isOpen, toggleChat, openChat, closeChat, unreadCount }`
  - `chatMessages: ReceivedChatMessage[]`, `sendMessage(message: string): Promise<void>`, `isSending: boolean`, `isOpen: boolean`, `toggleChat()`, `openChat()`, `closeChat()`, `unreadCount: number`.
- `type ReceivedChatMessage` - re-exported from `@livekit/components-react`.

## Interfaces
- **External services:** LiveKit (room DataChannel, via `useChat()`).

## Dependencies
- **Packages:** `@livekit/components-react` - `useChat`, `ReceivedChatMessage`; `react` - state, effects, refs.

## Used by
Nothing imports this file; it appears unused.

## Notes
- Messages you send yourself also increase `chatMessages.length`; if the panel is closed at that moment they count as unread.
- Superseded by `hooks/office/useMeetChat.ts`, which has a different return shape (`clearUnread` / `markChatHidden` instead of open/close state).
