# `app/(dashboard)/thoughts/components/CommandsMenu.tsx`

> Searchable "insert block" menu for the Thoughts BlockNote editor: lists text, list, colour, turn-into, link/reference, database-view, advanced, media and (simulated) AI blocks, and inserts or transforms the block at the cursor when one is clicked.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 884

## Purpose
The Thoughts note editor is built on BlockNote. When the user clicks the "+" button in a block's side menu, the editor opens a popover containing this component (in both `NoteDrawer.tsx` and `thoughts/page.tsx`). It acts like Notion's slash menu: a search box on top, grouped commands below, and each command calls BlockNote editor APIs against the block the "+" was pressed on. The visual preview cards for several groups come from `DatabaseViewsSection.tsx`.

## How it works
### Command execution (L703-L712)
`handleItemClick(item)` focuses the editor, tries `editor.setTextCursorPosition(block.id, "end")` (failures are logged and ignored), runs `item.action(editor, block)`, then calls `onClose`. Most actions use `insertOrUpdateBlock` from `@blocknote/core` (cast to `any`). It replaces the current block if it is empty or inserts a new block after it.

### Text-style sections (memoised `sections`, L92-L390)
- **Basic Text** - Text (`paragraph`), Heading 1-3 (`heading` with `level`), Block Quote (`quote`), Callout (a gray-background paragraph with italic placeholder text, not a dedicated callout block).
- **Lists** - `bulletListItem`, `numberedListItem`, `checkListItem`, `toggleListItem`, and Toggle Heading 1-3 (`heading` with `isToggleable: true` and default text).
- **Text Colors** - red/blue/green/yellow/purple/gray; calls `ed.addStyles({ textColor })` on the current selection.
- **Background Colors** - the same six colours plus "Default"; calls `ed.updateBlock(currentBlock, { props: { backgroundColor } })`.
- **Turn Into** - converts the cursor block in place with `ed.updateBlock` to paragraph, H1-H3, bullet, numbered, to-do or quote.
- **Links & References** - Page (calls `onCreateSubPage()` when provided, otherwise inserts a `nestedPage` block), Link to Page (`pageLinkPill`), Mention Person (`mentionPerson`), Mention Page (`mentionPage`), Date (`datePicker`), Reminder (`reminder`), Table of Contents (`tableOfContents`).

The custom block types referenced here (e.g. `pageLinkPill`, `tableView`, `syncedBlock`, `webBookmark`) are defined under `app/(dashboard)/thoughts/components/blocks/` and registered in the editor schema by the parent editor. They only work if that schema includes them.

### Search (L392-L405 and each `*Matches` memo)
A case-insensitive substring match on title, aliases and (for the text sections) subtext. Sections with no matches are hidden. When the search is empty everything is shown.

### Preview-card sections (L409-L442, L683-L701, rendered L765-L843)
- **Database Views** - Table, Board, Gallery, List, Calendar, Timeline, Chart, Linked View. Each is rendered with its preview component from `DatabaseViewsSection` and inserts the mapped custom block (`tableView`, `boardView`, `galleryView`, `documentList`, `calendarView`, `timelineView`, `chartView`, `linkedView`).
- **Advanced Blocks** - Comment (`comment` block); Duplicate (deep-clones the cursor block via JSON, strips the `id` from it and its direct children, and inserts the clone after it); Move To (only shows the toast "Select a destination page to move this block." and does nothing else); Delete (`ed.removeBlocks`); Template (`template`); Button (`button`); Synced Block (`syncedBlock`).
- **Media & Embeds** - Image/Video/Audio (built-in BlockNote blocks with empty `url` and preview props), File and PDF (both `file`), Web Bookmark (`webBookmark`), Embed (`embed`), Code Block (`codeBlock`), Math and Inline Equation (both `math`).

### AI Blocks (L444-L681, rendered L845-L873)
These are **simulated**. No AI service is called. Each item waits 1.2-1.5 s behind a `toast.promise`, then writes canned text:
- AI Summarize - inserts a quote: "AI Summary:" plus the first 100 characters of all paragraph text.
- AI Action Items / AI Find Action Items - insert a heading plus fixed placeholder checklist items.
- AI Improve Writing / Fix Spelling / Make Shorter / Make Longer / Explain This - replace the cursor block's text with the original text wrapped in a fixed prefix or suffix (Make Shorter keeps the first 60 characters).
- AI Custom Block and AI Translate - only show an info toast saying they are not available "in this offline version".

### Layout
A dark search input (autofocused), a scrollable list (max 500 px) and a footer hint "Click ESC to close the menu". Escape handling itself belongs to the parent popover.

## Exports
- `default CommandsMenu({ editor, block, onClose?, onShowYouTubeDialog?, onCreateSubPage? })`
  - `editor` - BlockNote editor instance (`any`); `block` - the block whose side-menu "+" was pressed; `onClose` - called after any command; `onCreateSubPage` - creates and opens a child note (used by "Page"); `onShowYouTubeDialog` - accepted but never used.

## Dependencies
- **Internal:** `./DatabaseViewsSection` - preview card components (`TablePreview` ... `LinkedViewPreview`, `CommentPreview` ... `SyncedBlockPreview`, `Media*Preview`). It also imports `PagePreview`, `LinkToPagePreview`, `MentionPersonPreview`, `MentionPagePreview`, `DatePreview`, `ReminderPreview`, `TableOfContentsPreview` and `Tag`, which are unused.
- **Packages:** `@blocknote/core` (`insertOrUpdateBlock`); `react` (`useState`, `useMemo`); `lucide-react` icons (`Minus`, `Info`, `Code` imported but unused); `sonner` (`toast`, `toast.promise`).

## Used by
- `app/(dashboard)/thoughts/components/NoteDrawer.tsx` - inside the side-menu "+" `Popover`, with `onCreateSubPage={handleCreateSubPage}`.
- `app/(dashboard)/thoughts/page.tsx` - the same pattern in the full-page editor.

## Notes
- The AI commands produce fake output that is indistinguishable in the note from real content (e.g. "Prepare revised roadmap timeline"). Users may mistake it for real AI results.
- The text, list, colour and turn-into commands, and the AI commands, are rendered as plain buttons. The database-view, advanced and media commands are rendered as preview cards, and their click handlers are built inline in JSX, not in the memoised lists.
- The "Page" action uses the closed-over `editor` rather than the `ed` argument; both are the same instance.
- `DatabaseViewsSection`'s own default export (a separate "Database Views" sub-panel with a back button) is not used here; this file renders the preview components directly.
