# `components/chat/CodeBlock.tsx`

> A dependency-free syntax-highlighted code block with a copy button, plus an inline-code span, for rendering code in chat messages.

**Kind:** React component (client) · **Lines:** 177

## Purpose
Chat messages are rendered as Markdown (see `components/chat/MessageContent.tsx`), and fenced code needs to look readable. Instead of shipping Prism or highlight.js (100KB+, as the file's comment notes), this file implements a small regex tokenizer that colours keywords, strings, numbers, comments and similar tokens for a handful of common languages.

## How it works
- **`PATTERNS`** holds ordered regex rules per language key: `js`, `ts`, `python`, `sql` (case-insensitive keywords), `json` (property keys vs string values) and `bash` (variables such as `$HOME`/`${X}` and common shell commands). Each rule maps to a CSS class: `tk-comment`, `tk-string`, `tk-number`, `tk-keyword`, `tk-class` (capitalised identifiers), `tk-func` (identifier followed by `(`), `tk-property`, `tk-variable`.
- **`ALIASES`** maps `javascript`, `jsx` -> `js`; `typescript`, `tsx` -> `ts`; `py` -> `python`; `sh`, `shell`, `zsh` -> `bash`.
- **`tokenize(code, lang)`** resolves the language; an unknown or missing language yields one plain token. Otherwise it runs every rule over the whole string, collecting all matches (skipping zero-length ones), sorts by start position then by length descending, and walks them left to right, dropping any match that overlaps text already covered. Gaps become unstyled tokens. Because comment and string rules come first and longer matches win at equal starts, keywords inside strings or comments are not re-coloured.
- **`CodeBlock`** renders a dark bordered box with a header showing the language (or "code") and a Copy button. Copy uses `navigator.clipboard.writeText`, shows "Copied" for 1.5s, and silently ignores clipboard errors. The body is a `<pre class="garage-code-block">` with each token as a `<span class="tk-...">` or a plain fragment.
- **`InlineCode`** is a styled `<code>` element for single-backtick inline code.

The colours for the `tk-*` classes and `garage-code-block` live in `app/globals.css`.

## Exports
- `CodeBlock({ code, lang?, className? })` - highlighted, copyable code block.
- `InlineCode({ children })` - inline monospace code span.

## Dependencies
- **Internal:** `lib/utils.ts` - `cn` class merging.
- **Packages:** `lucide-react` - `Copy`/`Check` icons; `react` - `useState`.

## Used by
- `components/chat/MessageContent.tsx` - Markdown `code` renderer for chat bubbles.

## Notes
- Tokenizing reruns on every render (no memoisation); fine for short chat snippets.
- The regex rules are module-level globals with the `g` flag; `tokenize` resets `lastIndex` before each use, which is required for correctness.
