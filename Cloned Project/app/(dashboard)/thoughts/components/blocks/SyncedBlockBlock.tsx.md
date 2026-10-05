# `app/(dashboard)/thoughts/components/blocks/SyncedBlockBlock.tsx`

> A BlockNote custom block (`syncedBlock`) for the Thoughts notes editor that shows a "Synced block" card with a source name, a last-synced label and a Refresh button.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 110

## Purpose
The Thoughts notes editor (a Notion-style editor built on BlockNote) offers a catalogue of custom blocks. This file defines the "synced block" entry, modelled on Notion's synced blocks, which would mirror content from another page. In its current form it is a visual placeholder: it does not fetch or mirror any content.

## How it works
- `SyncedBlockRenderer` (internal) reads two props from the block: `sourceName` (default `"Source Page"`) and `lastSynced` (default `"Just now"`).
- Local state `syncStatus` is `"synced" | "syncing" | "error"`, starting at `"synced"`.
- `handleSync` (the Refresh button) sets the status to `"syncing"`, then after a 1.2 s `setTimeout` sets it back to `"synced"` and writes `lastSynced: "Just now"` into the block's props via `editor.updateBlock`. No network call is made.
- The body shows one of three messages depending on `syncStatus`. Nothing in the file ever sets `"error"`, so the error message is unreachable.
- `syncedBlockBlock` registers the spec with `createReactBlockSpec`: type `"syncedBlock"`, the two string props, `content: "none"` (the block holds no inline rich text).

## Exports
- `syncedBlockBlock` - the BlockNote block spec factory (type `syncedBlock`, props `sourceName`, `lastSynced`). The editor schema calls it as `syncedBlockBlock()`.

## Dependencies
- **Packages:** `@blocknote/react` (`createReactBlockSpec`), `lucide-react` (icons), `react` (state and callbacks).

## Used by
- `app/(dashboard)/thoughts/components/blocks/index.ts` re-exports it. `app/(dashboard)/thoughts/page.tsx` adds it to the editor schema as `syncedBlock: syncedBlockBlock()`.

## Notes
- The sync is simulated. "Last synced" always becomes the literal string "Just now", not a timestamp, and the source page cannot be chosen from the UI.
- The 1.2 s timeout is not cleared on unmount, so it may call `editor.updateBlock` after the block has been removed.
