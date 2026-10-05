# `components/chat/FormatToolbar.tsx`

> A floating formatting popover that appears over a text selection in a chat textarea and wraps it in WhatsApp-style markdown (bold, italic, strikethrough, inline code, code block).

**Kind:** React component (client) · **Lines:** 246

## Purpose
Chat composers in Garage use a plain `<textarea>`. This component adds a lightweight "select text, click Bold" experience without a rich-text editor: it edits the raw string by inserting markdown tokens, and the message renderer (`components/chat/MessageContent.tsx`) interprets those tokens when displaying the message.

## How it works
**Positioning and visibility (L98-L174).** The component is bound to a textarea through `inputRef`. An effect attaches listeners:
- `mouseup` on the textarea records the pointer position and, on the next tick, shows the toolbar if the selection is non-empty. The toolbar is placed 48px above the mouse-up point, clamped to at least 80px from the viewport sides and 8px from the top. Browsers do not expose caret coordinates inside a textarea, hence the mouse-up anchor.
- `keyup`: selection-changing keys (Shift, arrows, Home, End, or any Ctrl/Cmd combination) clear the mouse anchor and re-evaluate, positioning the toolbar above the textarea's top centre. Any other key means the user is typing, so the toolbar hides.
- A document-level `mousedown` hides it unless the click is on the textarea or inside the popover (blur is not used because clicking a toolbar button would blur the textarea).
- Any scroll (capture phase) or window resize hides it.
- Renders nothing while `pos` is null; otherwise a `fixed`, `z-[200]` bar centred with `translateX(-50%)`.

**Editing helpers.**
- `wrapSelection` wraps the selected range with `left`/`right` tokens and calls `onChange` with the new string. If the selection already starts and ends with those tokens, it strips them instead (toggle). After the update it refocuses the textarea in `requestAnimationFrame` and reselects the inner text (or places the caret between the tokens when nothing was selected).
- `insertCodeBlock` surrounds the selection with a fenced ```` ``` ```` block, adding a newline before/after only when the neighbouring text does not already have one, and selects the body.

**Buttons.** Bold `*text*`, Italic `_text_`, Strikethrough `~text~`, Inline code `` `text` ``, Code block. Each button calls `preventDefault` on `mousedown` so the textarea keeps its selection and focus.

## Exports
- `FormatToolbar({ inputRef, value, onChange, className? })` - `inputRef` is the textarea ref, `value` the current text, `onChange(next)` the setter for the controlled value.

## Dependencies
- **Internal:** `lib/utils.ts` - `cn`.
- **Packages:** `lucide-react` - `Bold`, `Italic`, `Strikethrough`, `Code2`, `Braces`; `react` - hooks.

## Used by
- `components/dashboard/DMPage.tsx`, `components/dashboard/GlobalDMPage.tsx`, `components/dashboard/GroupChatPage.tsx` - chat composers.
- `components/garage-admin/SupportChatsConsole.tsx` - admin support-chat composer.

## Notes
- Bold uses a single asterisk (WhatsApp convention), not Markdown's `**`; the renderer must agree.
- The listener effect depends only on `inputRef`; if the textarea mounts after the toolbar, the listeners are not attached until the ref object changes.
- `Btn` is defined inside the render function, so it is a new component type on each render (harmless here, but it remounts the buttons).
