# `app/(dashboard)/thoughts/components/blocks/TableOfContentsBlock.tsx`

> A BlockNote custom block (`tableOfContents`) that builds a live table of contents from the note's headings, with click-to-scroll, inline renaming, hiding, a depth filter and custom entries.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 428

## Purpose
This is one of the custom blocks in the Thoughts notes editor. Dropping it into a note produces a navigable outline of that note's `heading` blocks. Its configuration (the entry list, max depth and hidden entries) is saved in the block's own props, so it travels with the note document.

## How it works

### State and persistence (L15-L45)
- The block props `entries`, `maxDepth` and `hiddenIds` are JSON or number strings. They are parsed on every render to seed the local state `entries: TOCEntry[]`, `maxDepth` (default 3) and `hiddenIds: Set<string>`.
- `TOCEntry` = `{ id, text, level, blockId?, isCustom? }`. Entries made from headings carry `blockId` (the heading's block id). Hand-added entries have `isCustom: true` and an id of `custom-<timestamp>`.
- `tocProps` (memoised) re-serialises the three state values. An effect writes them back with `editor.updateBlock(block, { props: tocProps })`. `isMountedRef` skips the first run, so simply mounting the block does not write to the document.

### Syncing with document headings (L47-L91)
- On mount, and again on every `editor.onChange`, `updateHeadings` walks `editor.document` (top-level blocks only) and collects every `heading` block. Its text is the concatenation of its inline content `text`, and its level is `props.level` (default 1). Headings with empty text are skipped.
- The merge keeps the existing order of auto entries whose heading still exists (refreshing their text and level), drops entries whose heading was deleted, appends newly found headings, and finally appends custom entries. Custom entries therefore always sit at the bottom.
- The header's Refresh button (L210-L244) runs the same merge inline (the code is duplicated).

### Interactions
- **Click an entry:** `scrollToHeading` finds `[data-id="<blockId>"]` in the DOM, smooth-scrolls to it and adds a ring highlight for 1.5 s.
- **Rename (pencil):** `startEditing` / `saveEditing`. For an auto entry the change is written to the heading block itself through `editor.updateBlock` with a single plain text node, which drops any bold or italic styling in the heading. The `onChange` listener then picks up the new text. For a custom entry only the local entry text changes. An empty value cancels the edit.
- **Hide (eye) and remove (trash):** shown only while the settings panel is open. Hiding adds the entry's id to `hiddenIds`. Removing deletes it from `entries`, but an auto entry comes back on the next document change because its heading still exists.
- **Max depth:** the settings panel offers H1, H2 or H3. Entries deeper than `maxDepth` are filtered out.
- **Add entry (+):** a text input plus an H1/H2/H3 select. Enter adds the entry and Escape closes the form.

### Display rules (L174-L189, L320-L407)
- `filteredEntries` applies the depth and hidden filters. If the note has no headings at all, five greyed-out sample entries ("Introduction", "Getting Started", and so on) are shown instead. These samples are not clickable.
- Indentation and colour follow the level (H1 none, H2 `ml-3`, H3 and deeper `ml-6`). Only H1 rows show a small "H1" tag.
- The header shows a "{n} headings" count.

## Exports
- `tableOfContentsBlock` - BlockNote block spec factory: type `tableOfContents`, props `entries` (default `"[]"`), `maxDepth` (default `"3"`), `hiddenIds` (default `"[]"`), `content: "none"`.

## Dependencies
- **Packages:** `@blocknote/react` (`createReactBlockSpec`), `lucide-react` (icons), `react` (hooks).

## Used by
- Re-exported by `app/(dashboard)/thoughts/components/blocks/index.ts`. `app/(dashboard)/thoughts/page.tsx` registers it as `tableOfContents: tableOfContentsBlock()` and inserts it from the slash menu with `insertOrUpdateBlock(editor, { type: "tableOfContents" })`.

## Notes
- Only top-level headings are found, because `editor.document.forEach` does not descend into nested `children`.
- The write-back effect depends on `block`. Each `updateBlock` produces a new block object, so a write can trigger another effect run. The value written is the same, so this settles, but it costs extra writes.
- The props are parsed with `JSON.parse` and no try/catch, so a corrupted `entries` or `hiddenIds` string will crash the block.
- An empty document shows the sample entries. If headings exist but every one is filtered out, the list is simply empty.
