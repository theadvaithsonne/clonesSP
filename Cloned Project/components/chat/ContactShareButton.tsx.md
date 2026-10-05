# `components/chat/ContactShareButton.tsx`

> A chat-composer button that opens a searchable member picker and hands back the chosen member encoded as a `[garage-contact]` message.

**Kind:** React component (client) · **Lines:** 154

## Purpose
Lets a user share another member's contact card in a chat. The component does not send anything itself: it encodes the selection with `encodeContact` from `lib/chat-markers.ts` and passes the string to the caller, which sends it as a normal text message. `MessageContent.tsx` later recognises the marker and renders a contact card.

## How it works
- A small ghost `Button` with a `UserPlus` icon opens a full-screen modal overlay (`z-[100]`); clicking the backdrop or the X closes it.
- A search box (auto-focused) filters `members` case-insensitively by name or email. Members without an `id`, or whose id is in `excludeIds` (typically the current user), are dropped; results are capped at 30.
- Each row shows an avatar (falling back to the first letter of name or email), the name or email, and the email underneath when a name exists.
- Picking a member builds `{ id, name: name || email, email, avatar: profilePicture, role }`, encodes it, calls `onShare(encoded)`, closes the modal and clears the query.

## Exports
- `ContactShareButton({ members, excludeIds?, onShare, className? })` - the button plus picker modal.
- `interface ContactCandidate` - `{ id, name?, email, profilePicture?, role? }`, the shape of each member passed in.

## Dependencies
- **Internal:** `components/ui/button.tsx` - trigger button; `components/ui/avatar.tsx` - avatars; `lib/chat-markers.ts` - `encodeContact`; `lib/utils.ts` - `cn`.
- **Packages:** `lucide-react` - icons; `react` - `useState`, `useMemo`.

## Used by
- `components/dashboard/DMPage.tsx`, `components/dashboard/GlobalDMPage.tsx`, `components/dashboard/GroupChatPage.tsx` - chat composers.
- `components/garage-admin/SupportChatsConsole.tsx` - admin support-chat composer.
