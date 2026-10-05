# `hooks/office/useEmojiReactions.ts`

> Client hook that sends and receives floating emoji reactions in a LiveKit room over the DataChannel topic `emoji-reaction`, keeping each reaction on screen for 3 seconds.

**Kind:** React hook · **Lines:** 95

## Purpose
Powers the reaction buttons in the conference `ControlBar` and the animated overlay (`EmojiReactionOverlay`). Reactions are peer-to-peer messages through LiveKit; the backend is not involved and nothing is stored. Must run under a `<LiveKitRoom>` provider.

## How it works
- **Constants:**
  - `EMOJI_TOPIC = 'emoji-reaction'`.
  - `REACTION_DURATION = 3000` ms on screen.
  - `COOLDOWN = 500` ms between sends from this client.
- `addReaction(reaction)` appends a reaction to `reactions` and schedules its removal after 3 s.
- **Receiving:** `useDataChannel(EMOJI_TOPIC, onMessage)` decodes each payload as UTF-8 JSON. If it has `emoji` and `id`, it is shown with a random horizontal position `x` between 10 and 90 (percent). The sender name defaults to "Unknown". Malformed payloads are ignored.
- **Sending:** `sendReaction(emoji)`:
  1. Drops the call if the last send was less than 500 ms ago.
  2. Builds `{ emoji, senderName, senderId, id: nanoid() }` from the local participant's name or identity.
  3. Shows the reaction locally straight away.
  4. Publishes it with `send(bytes, { reliable: true, topic: EMOJI_TOPIC })`. Send errors are logged to the console only.

## Exports
- `useEmojiReactions(): { reactions: EmojiReaction[]; sendReaction(emoji: string): Promise<void> }`
- `interface EmojiReaction { emoji; senderName; senderId; id; x: number }` - `x` is a 10-90 horizontal position.
- `REACTION_EMOJIS` - the six reaction choices: `{ key, char, label }` for thumbsup, heart, laugh, clap, fire, surprised.

## Interfaces
- **External services:** LiveKit DataChannel (reliable messages on topic `emoji-reaction`).

## Dependencies
- **Packages:** `@livekit/components-react` - `useDataChannel`, `useLocalParticipant`; `nanoid` - unique reaction ids; `react`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`)
- `components/office/ControlBar.tsx` - imports only `REACTION_EMOJIS` (to draw the picker).
- `components/office/EmojiReactionOverlay.tsx` - imports only the `EmojiReaction` type; the conference page passes it the list.

## Notes
- Each call of the hook has its own `reactions` list. The overlay must receive the list from the component that calls `useEmojiReactions()`; calling the hook again elsewhere would start an empty list with a second DataChannel listener.
- The cooldown is client-side only; other clients do not rate-limit incoming reactions.
