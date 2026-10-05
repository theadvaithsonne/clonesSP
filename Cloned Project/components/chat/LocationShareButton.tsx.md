# `components/chat/LocationShareButton.tsx`

> A chat-composer button that reads the browser's current geolocation and hands it back encoded as a `[garage-location]` message.

**Kind:** React component (client) · **Lines:** 69

## Purpose
Lets a user drop their current location into a chat. Like the other rich-message buttons, it only produces the encoded string (`encodeLocation` from `lib/chat-markers.ts`); the caller sends it as ordinary message text, and `MessageContent.tsx` renders it as a location card.

## How it works
- If `navigator.geolocation` is missing, a sonner toast reports that geolocation is unsupported.
- Otherwise the button enters a busy state (spinner, disabled) and calls `getCurrentPosition` with `enableHighAccuracy: true`, a 10s timeout and a 60s `maximumAge` (a cached fix up to a minute old is accepted).
- On success the latitude/longitude are rounded to 6 decimal places and encoded with the label `"My current location"`, then passed to `onShare`.
- On failure a toast names the cause: permission denied, position unavailable, timeout, or a generic message.

## Exports
- `LocationShareButton({ onShare, className? })` - `onShare(encoded: string)` receives the marker string; the caller is responsible for sending.

## Interfaces
- **External services:** browser Geolocation API (prompts the user for permission).

## Dependencies
- **Internal:** `components/ui/button.tsx` - trigger; `lib/chat-markers.ts` - `encodeLocation`; `lib/utils.ts` - `cn`.
- **Packages:** `lucide-react` - `MapPin`/`Loader2`; `sonner` - error toasts; `react` - `useState`.

## Used by
- `components/dashboard/DMPage.tsx`, `components/dashboard/GlobalDMPage.tsx`, `components/dashboard/GroupChatPage.tsx` - chat composers.
- `components/garage-admin/SupportChatsConsole.tsx` - admin support-chat composer.

## Notes
- The location is shared immediately without a confirmation step once the browser grants permission.
