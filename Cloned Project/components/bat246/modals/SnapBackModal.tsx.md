# `components/bat246/modals/SnapBackModal.tsx`

> Static informational modal explaining Snap-Back Loans for the current board; it loads no data.

**Kind:** React component · **Lines:** 45

## Purpose
Opened from the board toolbar's Snap-Back action. It explains that a Snap-Back Loan is granted when a board splits and a player cannot cover their costs, repaid first from future earnings, and shows the board's tracking number.

## How it works
Renders a fixed overlay with a short explanation, a box with `board.trackingNumber`, and the placeholder text "Loan records are loaded from the server. Connect backend to view active loans." The header X and the Close button call `onClose`.

## Exports
- `SnapBackModal({ board, onClose }: { board: BoardData; onClose: () => void })` - the modal.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData`.
- **Packages:** `lucide-react` - `X`, `RefreshCcw` icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx`, when `openModal === "snapback"`.

## Notes
- Placeholder: it does not call any endpoint. The working Snap Back Loan request flow is `components/bat246/modals/SnapBackLoanModal.tsx`, backed by `/backend/bat246/snapbackloans/*`.
