# `components/chat/GifPicker.tsx`

> A GIPHY-backed GIF and sticker picker modal that hands the chosen item back as a `[garage-gif]` chat message.

**Kind:** React component (client) · **Lines:** 293

## Purpose
Lets users search for and send GIFs and stickers in chats and webinar chat. The browser never talks to GIPHY directly: `lib/giphy.ts` calls the Next.js proxy route `app/api/giphy/route.ts`, which holds the `GIPHY_API_KEY` server-side. The picked item is encoded with `encodeGif` and passed to the caller, which sends it as ordinary message text.

## How it works
**Open state (controlled or uncontrolled).** By default the component renders its own trigger button (a `Sparkles` icon) and keeps `open` in local state, as the DM composer uses it. A parent can instead pass `open`, `onOpenChange` and `hideTrigger` to drive it from its own "+" menu; `setOpen` updates local state and also calls `onOpenChange`.

**Loading results (L50-L96).** Whenever the picker is open and the tab (`gifs` / `stickers`) or query changes, an effect fetches up to 30 results:
- tab `gifs`: `giphySearch(q)` or, with an empty query, `giphyTrending()`;
- tab `stickers`: `giphyStickersSearch(q)` or `giphyStickersTrending()`.

Typing is debounced 300ms (no delay for an empty query). A sequence counter (`requestSeq`) discards responses that arrive after a newer request began. If the error message starts with `"GIPHY not configured"` (what `lib/giphy.ts` throws on an HTTP 503 from the proxy), a dedicated setup screen is shown telling the developer to set `GIPHY_API_KEY` and linking to the GIPHY developer dashboard; other errors show in red.

**Picking (L98-L113).** `pickShare` from `lib/giphy.ts` chooses the full-quality URL (downsized, then original, then fixed sizes). The component encodes `{ url, w, h, title, kind: "sticker" | "gif", source }` where `source` is GIPHY's share page URL, calls `onShare`, closes and clears the query.

**UI.** A bottom-sheet on mobile / centred modal on larger screens (max height `min(540px, 85vh)`), GIFs/Stickers tabs, an auto-focused search box with a clear button, a 3-column grid of lazy-loaded thumbnails (`pickPreview`, preferring small variants), and a "Powered by GIPHY" footer required by GIPHY's brand guidelines.

## Exports
- `GifPicker({ onShare, className?, open?, onOpenChange?, hideTrigger? })` - picker; `onShare(encoded)` receives the marker string.

## Interfaces
- **Backend endpoints called:** `GET /api/giphy?action=search|trending&type=gifs|stickers&q=...&limit=30` - Next.js route handler in this repo (not under `/backend`), proxied to GIPHY.
- **External services:** GIPHY API (via the proxy); thumbnails and shared GIFs load directly from GIPHY's CDN URLs.
- **Environment variables:** `GIPHY_API_KEY` - read by the proxy route, only mentioned in this file's setup message.

## Dependencies
- **Internal:** `lib/giphy.ts` - proxy client and variant pickers; `lib/chat-markers.ts` - `encodeGif`; `components/ui/button.tsx` - trigger; `lib/utils.ts` - `cn`.
- **Packages:** `lucide-react` - icons; `react` - hooks.

## Used by
- `components/dashboard/DMPage.tsx`, `components/dashboard/GlobalDMPage.tsx`, `components/dashboard/GroupChatPage.tsx` - chat composers.
- `components/garage-admin/SupportChatsConsole.tsx` - admin support chat.
- `components/webinar/ChatPanel.tsx` - webinar chat.

## Notes
- `notConfigured` is never reset to false on a later successful load; once shown, the setup screen persists until the component remounts.
- The query is not cleared when the user closes without picking, so reopening resumes the last search.
