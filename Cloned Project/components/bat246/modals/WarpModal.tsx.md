# `components/bat246/modals/WarpModal.tsx`

> Read-only modal explaining a board's current warp level and each 1st Base player's progress toward warping (two sales each).

**Kind:** React component · **Lines:** 134

## Purpose
In BAT246, each of the four 1st Base players "warps" after making two sales; each warp raises the board's warp level, and WARP-4 kills the Protection Period clock and makes the split imminent. This modal visualises that state from the board data already loaded on the page.

## How it works
- `WARP_COLORS` and `WARP_LABELS` map `board.warpCount` (0-4) to a text colour and an explanation (for example "WARP-4 - All 4 warped, clock killed, split imminent").
- The top tile shows `WARP-<n>` (or a dash for 0) and its label.
- For each index 0-3 it builds a row labelled `1BA`/`1BB`/`1BC`/`1BD` from `board.firstBase[i]`:
  - `ws = slot.warpStatus ?? 0`; `isWarped = ws >= 2`.
  - Shows the player's name (or "Vacant"), a status line ("Fully warped - 2 of 2 sales made", "1 of 2 sales made", "No sales yet - 0 of 2", or "Slot empty"), and two dots filled according to `ws`.
  - Warped rows get purple styling via `cn`.
- Close and the header X call `onClose`. No network calls.

## Exports
- `WarpModal({ board, onClose }: { board: BoardData; onClose: () => void })` - the modal.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData` (`warpCount`, `firstBase`, `warpStatus`); `lib/utils.ts` - `cn` class-name helper.
- **Packages:** `lucide-react` - `X`, `Rocket` icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx`, when `openModal === "warp"`.

## Notes
- The numbered circle shows the row index + 1, not the order in which players actually warped, so "level 2" on 1BB does not mean 1BB caused WARP-2.
