# `hooks/office/useHandRaise.ts`

> Client hook for raise-hand in a LiveKit conference: keeps the set of raised hands in sync across participants over the DataChannel topic `hand-raise`, with a host "lower someone's hand" action.

**Kind:** React hook · **Lines:** 104

## Purpose
Lets participants signal that they want to speak. As the header comment explains, hands are ephemeral: there is no backend and no persistence. Someone who joins late does not see hands raised before they arrived, and a reload starts with an empty set (the same behaviour as Google Meet / NetworkChains). Must run under a `<LiveKitRoom>` provider.

## How it works
- `raisedIds: Set<string>` holds the LiveKit identities with a raised hand.
- **Receiving:** `useDataChannel('hand-raise', onMessage)` decodes JSON `HandRaisePayload { userId, name, raised, ts }`. It adds or removes `userId` in a new `Set`, so React re-renders. Payloads without a `userId`, or that fail to parse, are ignored.
- `publish(userId, raised)` encodes a payload (using the local participant's name or identity as `name`, plus a timestamp) and sends it with `send(bytes, { reliable: true })`. The topic comes from the `useDataChannel('hand-raise', …)` binding.
- `myHand` is `raisedIds.has(localParticipant.identity)`.
- `toggle()` flips the local hand optimistically in state, then broadcasts it.
- `lower(identity)` (host action) removes the target locally and broadcasts `raised: false` for that identity. Every client, including the target's own, clears it.
- `raisedList` is a memoised array copy of the set, for rendering.

## Exports
- `useHandRaise(): { raisedIds: Set<string>; raisedList: string[]; myHand: boolean; toggle(): void; lower(identity: string): void }`

## Interfaces
- **External services:** LiveKit DataChannel (reliable messages on topic `hand-raise`).

## Dependencies
- **Packages:** `@livekit/components-react` - `useDataChannel`, `useLocalParticipant`; `react`.

## Used by
- `app/meet/conference/[orgId]/[roomId]/ConferenceCallStandalone.tsx` (route `/meet/conference/[orgId]/[roomId]`).

## Notes
- `lower()` is not restricted to hosts in the hook: any client that calls it can broadcast a lower for anyone. Only the UI limits it.
- The `name` field in a payload always carries the sender's name. When a host lowers someone else's hand, the payload's `name` is the host's, not the target's.
- A raised hand stays in everyone's set if the participant leaves the room without lowering it, unless the UI filters by the people currently present.
