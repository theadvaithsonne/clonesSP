# `components/chat/MessageContent.tsx`

> Renders the body of one chat message: either a rich card for marker-encoded messages (location, contact, GIF, slash-command cards) or the text as chat-flavoured Markdown with mentions, links and code highlighting.

**Kind:** React component (client) · **Lines:** 421

## Purpose
Every chat surface in Garage (DMs, global DMs, group chats, the admin support console) stores messages as a plain `text` string. Rich messages are encoded inside that string with a prefix such as `[garage-location]{json}` (see `lib/chat-markers.ts`), so the backend schema never had to change. This component is the single place that decodes those strings for display, and that turns ordinary text into safe, compact Markdown suited to a chat bubble.

## How it works
### 1. Rich-message cards (L269-L319)
`parseMarker(text)` (memoised) detects a marker. Depending on its type the component returns:
- `location` -> local `LocationCard`: a link to `https://www.google.com/maps?q=<lat>,<lng>` with a background preview image from `staticmap.openstreetmap.de` (no API key; a gradient shows if the image is blocked), the label (default "Shared location") and coordinates to 4 decimals.
- `contact` -> local `ContactCard`: avatar, name, email and role.
- `gif` -> local `GifCard`: the GIF/sticker image capped at 220px wide (140px for stickers, which also get a transparent background), height computed from the stored aspect ratio, linking to the GIPHY source page or the image URL.
- `task`, `poll`, `meet`, `deal`, `approval` (also receives `currentUserId`), `doc`, `share` -> the matching card from `components/chat/SlashCommandCards.tsx`.

All card links call `stopPropagation` so clicking them does not trigger the bubble's own click handler (e.g. message actions).

### 2. Text preprocessing (`preprocess`, L74-L148)
Before Markdown rendering the text is rewritten. It is first split on code regions (```` ``` ```` blocks and single-backtick spans) and only the non-code parts are changed:
1. **Mentions.** `mentionTargets` builds the list of strings that may follow `@` for each user id in `mentions`: the user's name, email and id from `userMap`, plus `all` and `here` (key `"everyone"`), sorted longest first so "@Chiranjeeb Jena" wins over "@Chiranjeeb". One case-insensitive regex (not preceded by a word char or `@`, followed by whitespace, end or punctuation, matching the backend's resolution boundary) replaces each tag with a Markdown link `[@Name](mention://<userId>)`, escaping brackets/backticks in the link text.
2. **WhatsApp formatting.** Single `*bold*` becomes `**bold**` and single `~strike~` becomes `~~strike~~` (double/triple delimiters and whitespace-padded content are left alone). `_italic_` is already valid Markdown.
3. **Bare URLs** (`http(s)://...`, not already inside `](`) become `[url](url)` links.
4. **Line breaks.** Single newlines become Markdown hard breaks (`"  \n"`) so chat line breaks survive.

### 3. Markdown rendering (L321-L419)
`ReactMarkdown` with `remark-gfm` renders the processed text with custom element mappings tuned for small bubbles:
- `p` renders as `<span>` so the bubble's timestamp/edited marker can sit on the last text line.
- `a`: `mention://` links render as a brand-coloured bold span, but only if the key is really in `mentions` (a hand-typed `[@x](mention://...)` renders as plain text). `@all/@here` count as resolved when `mentions` is non-empty. The tag gets a tinted background when it refers to the current user (directly, or via `@all/@here` expanded to include `currentUserId`). Other links open in a new tab with `noopener noreferrer`.
- The `urlTransform` lets `mention://` URLs through only when the caller passed `mentions` (group chat); otherwise react-markdown's `defaultUrlTransform` sanitises the URL, which blanks unsafe schemes such as `javascript:`.
- `code` -> `InlineCode` or `CodeBlock` (language from `language-xxx` class), `pre` -> fragment; headings render as bold block spans; lists, blockquote and `hr` get compact styling; `strong`, `em`, `del` get explicit classes.

## Exports
- `MessageContent({ text, isOwnMessage?, mentions?, userMap?, currentUserId? })` - `mentions` is the array of mentioned user ids as stored by the backend; `userMap` maps id -> `{ id, name?, email, profilePicture? }`; `isOwnMessage` switches card/link colours for the sender's own bubble.

## Interfaces
- **External services:** OpenStreetMap static map service (`staticmap.openstreetmap.de`) for location previews; Google Maps links; GIPHY CDN for GIF images.

## Dependencies
- **Internal:** `lib/chat-markers.ts` - `parseMarker`; `components/chat/SlashCommandCards.tsx` - `TaskCard`, `PollCard`, `MeetCard`, `DealCard`, `ApprovalCard`, `DocCard`, `ShareCard`; `components/chat/CodeBlock.tsx` - `CodeBlock`, `InlineCode`; `components/ui/avatar.tsx` - contact avatar; `lib/utils.ts` - `cn`.
- **Packages:** `react-markdown` (v10) - Markdown rendering and `defaultUrlTransform`; `remark-gfm` - GFM (strikethrough, tables, autolinks); `lucide-react` - icons; `react` - `useMemo`.

## Used by
- `components/dashboard/DMPage.tsx`, `components/dashboard/GlobalDMPage.tsx`, `components/dashboard/GroupChatPage.tsx` - chat message bubbles (group chat passes `mentions`/`userMap`/`currentUserId`).
- `components/garage-admin/SupportChatsConsole.tsx` - admin support chat.

## Notes
- react-markdown 9+ no longer passes an `inline` prop to the `code` renderer, so with the installed v10 the `inline` branch is never taken and single-backtick code is likely rendered through `CodeBlock` as well. Worth verifying visually before relying on `InlineCode`.
- Raw HTML in messages is not rendered (no `rehype-raw`), which keeps user text safe.
- A message is treated as a card only if the whole trimmed text is a valid marker payload; a malformed payload falls through to Markdown and shows the raw text.
