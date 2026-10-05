# `hooks/office/useMeetChat.ts`

> Conference chat hook: sends through LiveKit's `useChat()` but reads the message list from the app-wide `MeetingProvider` buffer, and tracks an unread counter.

**Kind:** React hook · **Lines:** 68

## Purpose
Feeds the chat tab of the standalone conference sidebar. The hook's comment explains the design: LiveKit's `useChat()` keeps history in component state, so navigating away (for example minimising the call) wiped the chat. By reading messages from `useMeeting()` (the `MeetingProvider` mounted once in `app/layout.tsx`), history survives mount/unmount cycles. Sending still uses `useChat().send`, which simply publishes on the room's DataChannel.

## How it works
- `const { send, isSending } = useChat()` - must be called under `<LiveKitRoom>`.
- `const { chatMessages } = useMeeting()` - the persisted buffer, cast with `as unknown as ReceivedChatMessage[]` so callers keep the LiveKit type.
- `unreadCount` and `chatVisible` are local state; `prevCountRef` stores the previous message count.
- An effect adds the number of newly arrived messages to `unreadCount` whenever the list grows while `chatVisible` is `false`.
- `clearUnread()` zeroes the counter and marks chat visible (called when the chat tab is opened); `markChatHidden()` marks it hidden again.
- `sendMessage(message)` skips blank text, otherwise awaits `send(message)`.

## Exports
- `useMeetChat(): { chatMessages, sendMessage, isSending, unreadCount, clearUnread, markChatHidden }`
  - `chatMessages: ReceivedChatMessage[]` (really the `MeetingProvider` buffer), `sendMessage(message: string): Promise<void>`, `isSending: boolean`, `unreadCount: number`, `clearUnread()`, `markChatHidden()`.
- `type ReceivedChatMessage` - re-exported from `@livekit/components-react`.

## Interfaces
- **External services:** LiveKit room DataChannel (send path).

## Dependencies
- **Internal:** `lib/meeting-context.tsx` - `useMeeting()`; its `chatMessages` come from `app/meet/join/useMeetLiveKit.ts`.
- **Packages:** `@livekit/components-react` - `useChat`, `ReceivedChatMessage`; `react`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`), which passes the result into its sidebar (`chatMessages`, `onSendMessage`, `onChatViewed`, `onChatHidden`).

## Notes
- The cast hides a shape mismatch. The buffer in `useMeetLiveKit` holds `{ id, sender, senderName, msg, time }`, whereas `ReceivedChatMessage` has fields such as `message`, `from` and `timestamp`. Consumers must read whichever fields they actually render.
- The send and receive paths use different rooms and formats: `useChat().send` publishes on the `<LiveKitRoom>` the conference page mounts, while the buffer is filled by the separate `Room` inside `useMeetLiveKit` (the `/meet/join` flow), which stores DataChannel payloads shaped `{ msg }` and its own sent messages. If the conference room is not that same `Room`, messages sent here may not show up in `chatMessages`. Check this when debugging missing conference chat.
- `useMeeting()` throws if `MeetingProvider` is missing; it is mounted in `app/layout.tsx`.
