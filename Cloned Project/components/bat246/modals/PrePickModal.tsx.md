# `components/bat246/modals/PrePickModal.tsx`

> Modal for "pre-picks": reserving an At Bat slot (AB1-AB8) on a board for a specific recruit before they join.

**Kind:** React component · **Lines:** 123

## Purpose
A BAT246 pre-pick lets a player earmark which At Bat slot a future recruit will land in. This modal lists the board's existing pre-picks and lets the user create one by entering a player id and choosing a free slot. Unlike penciling, pre-picks do not expire and are not limited to the Protection Period.

## How it works
- `takenSlots` = the set of `targetAbSlot` values in `board.prePick`.
- Existing pre-picks are listed with the last 8 characters of `playerId` and the slot.
- The user types a raw MongoDB player `_id`, picks a slot (taken slots are disabled) and presses "Set Pre-Pick".
- `save()` POSTs `{ playerId, targetAbSlot }` with the `garage_tok` Bearer token; errors show `data.error` (or "Failed"); success calls `onClose()`. The board refreshes through the parent's `useBoard` poll.

## Exports
- `PrePickModal({ board, onClose }: { board: BoardData; onClose: () => void })` - the modal.

## Interfaces
- **Backend endpoints called:** `POST /backend/bat246/boards/:id/prepick` - `requireAuth`; `updatePrePick` -> `setPrePick` in `server/bat246/services/bat246.service.ts` removes any existing pre-pick for that player and pushes `{ playerId, targetAbSlot, createdAt }`. Returns `{ ok, prePick }`.
- **Database:** indirectly writes the `prePick` array on the `Bat246Board` document.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData`, `PrePickEntry`.
- **Packages:** `react` - `useState`; `lucide-react` - `X`, `ListOrdered` icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx`, when `openModal === "prepick"`.

## Notes
- "One active pre-pick per player" is enforced by the server replacing the player's previous entry. Slot conflicts between different players are only prevented client-side, and the server does not check who the caller is.
