# `components/chat/ChatPreviewText.tsx`

> Renders a chat's last-message preview, turning encoded rich-message payloads into a small icon plus a short label.

**Kind:** React component (client) · **Lines:** 95

## Purpose
Rich chat messages (GIFs, stickers, locations, contacts, slash-command cards) are stored in the ordinary `text` field as a marker such as `[garage-gif]` followed by JSON (see `lib/chat-markers.ts`). In a conversation list that raw JSON would be unreadable, so this component shows them the way WhatsApp does: an icon and a word, while keeping any sender prefix such as `"You: "`.

## How it works
- `MARKERS` lists the ten marker prefixes from `lib/chat-markers.ts`.
- `ChatPreviewText` finds the earliest index at which any marker occurs in `text`. If none occurs, the text renders unchanged.
- Otherwise it calls `parseMarker` on the substring starting at that index. If parsing fails (malformed JSON or missing required fields) only the prefix before the marker is shown, so raw JSON never leaks into the list.
- On success `describe()` maps the parsed type to a lucide icon and label:
  - `gif` -> `Sticker` "Sticker" when `data.kind === "sticker"`, else `ImagePlay` "GIF"
  - `location` -> `MapPin`, the location label or "Location"
  - `contact` -> `User`, contact name
  - `task` / `approval` -> `CheckSquare`, title
  - `poll` -> `BarChart3`, question
  - `meet` -> `CalendarClock`, title
  - `deal` -> `Briefcase`, deal name
  - `doc` -> `FileText`, file name
  - `share` -> `Share2`, item title
- The output is a fragment: prefix text, an inline 14px icon (`aria-hidden`), then the label.

## Exports
- `ChatPreviewText({ text }: { text: string })` - preview renderer for a single last-message string.

## Dependencies
- **Internal:** `lib/chat-markers.ts` - marker constants, `parseMarker` and the `ParsedMarker` union.
- **Packages:** `lucide-react` - icons; `react`.

## Used by
- `components/dashboard/RightPanel.tsx` - chat/DM list previews.

## Notes
- Anything after the marker's JSON is part of what `parseMarker` parses, so a marker in the middle of free text followed by more text will fail to parse and the preview is truncated at the marker.
