# `components/bat246/modals/PencilingModal.tsx`

> Modal for "penciling": reserving an At Bat slot (AB1-AB8) for a 1st Base player for 24 hours during a board's Protection Period.

**Kind:** React component · **Lines:** 143

## Purpose
Penciling is a BAT246 rule that lets a 1st Base player hold an At Bat slot temporarily while the board is still in its Protection Period (PP). This modal shows the active pencilings and lets the user add one by entering a player id and picking a slot.

## How it works
- If `isPostPP` is true, only a red notice is shown ("PP has ended for this board") and the footer button reads "Close".
- Otherwise:
  - `activePencilings` = `board.penciling` entries whose `expiresAt` is still in the future; `takenSlots` is the set of their `targetAbSlot`s.
  - Active entries are listed with the last 8 characters of `playerId`, the slot and the whole hours left.
  - The user types a raw MongoDB player `_id` into a text input and picks one of eight slot buttons; taken slots are disabled.
  - `save()` POSTs `{ playerId, targetAbSlot }` with the `garage_tok` Bearer token. On a non-2xx response it shows `data.error` (or "Failed"); on success it calls `onClose()`.
- The modal does not refresh the board itself; the parent's 10-second `useBoard` poll picks up the change.

## Exports
- `PencilingModal({ board, onClose, isPostPP }: { board: BoardData; onClose: () => void; isPostPP: boolean })` - the modal.

## Interfaces
- **Backend endpoints called:** `POST /backend/bat246/boards/:id/penciling` - `requireAuth`; `updatePenciling` -> `setPenciling` in `server/bat246/services/bat246.service.ts` rejects when the PP has ended, removes any existing penciling for that player, and pushes a new entry expiring 24 hours later. Returns `{ ok, penciling }`.
- **Database:** indirectly writes the `penciling` array on the `Bat246Board` document.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** reads `localStorage.garage_tok`.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData`, `PencilingEntry`.
- **Packages:** `react` - `useState`; `lucide-react` - `X`, `Pencil` icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx`, when `openModal === "penciling"` (they pass `isPostPP`).

## Notes
- The UI text says "1st Base players only", but neither this modal nor the server code it calls checks that the player is on 1st Base or belongs to the caller; any authenticated user can pencil any player id on any board during PP.
- The server does not reject a slot that another player has already penciled; only the client disables taken slots.
