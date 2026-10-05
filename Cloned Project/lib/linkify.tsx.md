# `lib/linkify.tsx`

> Converts plain chat text into React nodes with every URL rendered as a clickable, new-tab link.

**Kind:** frontend library · **Lines:** 54

## Purpose
Chat messages in the office/meeting and webinar chat panels are stored as plain text. This helper gives them WhatsApp-style links (blue, underlined, open in a new tab) without using `dangerouslySetInnerHTML`, so message text is still rendered as escaped React text.

## How it works
- `URL_REGEX` matches `http://`, `https://` or bare `www.` URLs, stopping at whitespace and at `<`, `>`, `'`, `"`, `)` and `]` so trailing brackets and quotes are not swallowed.
- `linkifyText` creates a fresh `RegExp` from that source each call (avoiding shared `lastIndex` state on the global regex), walks the matches, pushes the text between matches as strings and each URL as an `<a>`. A `www.` match gets `https://` prepended for its `href`.
- Links use `target="_blank"` with `rel="noopener noreferrer"`, and `onClick` calls `stopPropagation()` so clicking a link does not trigger the parent message's own click handler.
- Colour depends on `opts.isOwnMessage`: lighter blue/white for the user's own bubble, standard blue for others.
- If the text produced no parts (empty string), the original text is returned; otherwise the parts are wrapped in a fragment. Keys are the match index.

## Exports
- `linkifyText(text: string, opts?: { isOwnMessage?: boolean }): React.ReactNode` - linkified rendering of `text`.

## Dependencies
- **Packages:** `react` - JSX and `React.ReactNode` type.

## Used by
- `components/office/ChatPanel.tsx`
- `components/office/MeetSidebar.tsx`
- `components/webinar/ChatPanel.tsx`

## Notes
- Trailing sentence punctuation such as `.` or `,` is not excluded by the regex, so `see www.example.com.` links to `www.example.com.`.
- Only `http(s)` and `www.` URLs are linked; `javascript:` and other schemes are never turned into links.
