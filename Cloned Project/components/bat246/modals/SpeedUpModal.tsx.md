# `components/bat246/modals/SpeedUpModal.tsx`

> Read-only modal that shows how many At Bat and Dugout slots are still open on a board, plus its warp level and status, to encourage recruiting.

**Kind:** React component · **Lines:** 71

## Purpose
Opened from the board toolbar's "Speed Up" action. In BAT246, filling slots with recruits drives warps and the board split, so this modal summarises the gap and tells the player to share the board link.

## How it works
- `emptyAbSlots` = number of falsy entries in `board.atBat`.
- `emptyDugoutSlots` = `max(0, 8 - number of filled board.dugout entries)` (the Dugout is treated as 8 seats).
- Shows the two counts as tiles, then a status box: warp level (`"None"` when `board.warpCount` is 0, otherwise `WARP-<n>`), `board.status` and `board.trackingNumber`.
- The header X and the Close button call `onClose`. No network calls.

## Exports
- `SpeedUpModal({ board, onClose }: { board: BoardData; onClose: () => void })` - the modal.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData`.
- **Packages:** `lucide-react` - `X`, `Zap` icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx`, when `openModal === "speedup"`.

## Notes
- The Dugout size of 8 is hardcoded here rather than taken from the board data.
