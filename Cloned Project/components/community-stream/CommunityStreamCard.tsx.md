# `components/community-stream/CommunityStreamCard.tsx`

> Animated tile that advertises a Community Stream: it shows the channel title and occupant count, and the user clicks it to join.

**Kind:** React component (client) · **Lines:** 109

## Purpose
Gives the user a clickable entry point to a channel's Community Stream (the 2D proximity video room). It is the "lobby card" counterpart of `CommunityStreamOverlay`, which renders the room itself.

## How it works
- The component is wrapped in `memo` and sets `displayName` to `"CommunityStreamCard"`.
- `amInRoom` is true when `isInStream` is true, or when `meId` appears in `occupants`.
- The root is a `framer-motion` `motion.div` with these behaviours:
  - It animates in and out (fade, scale and a vertical slide over 0.4 s) and uses `layout` animation.
  - When the user is **not** in the room, it is clickable (`onClick={onJoin}`), scales to 1.02 on hover, and shows a dark hover overlay that reads "Join Stream".
  - When the user is in the room, the border is brighter purple and the card has no click handler.
- Header: a purple `Video` icon, the truncated `channelTitle`, and the caption "Community Stream".
- Body: a `Users` icon followed by "N participant(s)", with correct pluralisation.
- Bottom-right: up to 3 circular avatars, then a `+N` bubble when there are more occupants.
  - Each avatar shows `profilePicture` when set; otherwise it shows the first two letters of `name` or `email`, upper-cased, with `?` as the fallback.
  - The local user's avatar gets a purple ring.

## Exports
- `CommunityStreamCard` (named, memoised component). Props:
  - `channelTitle: string`: title shown in the header.
  - `occupants: CommunityStreamParticipant[]`: people currently in the stream.
  - `meId: string`: the current user's id, used for highlighting.
  - `isInStream: boolean`: true when the local user has already joined.
  - `onJoin: () => void`: called when the user clicks the card.
  - `onLeave: () => void`: accepted but **never used** inside the component.

## Dependencies
- **Internal:** `lib/utils.ts` (`cn` class merger); `./types` (`CommunityStreamParticipant`).
- **Packages:** `react` (`memo`); `framer-motion` (animation); `lucide-react` (`Video` and `Users` icons).

## Used by
- `components/community-stream/index.ts` re-exports it. No other file in the project imports `CommunityStreamCard`, so the component currently appears unused.

## Notes
- Avatars use a plain `<img>` tag rather than `next/image`.
- The `onLeave` prop is dead. The card offers no way to leave; leaving is handled by `CommunityStreamOverlay`.
