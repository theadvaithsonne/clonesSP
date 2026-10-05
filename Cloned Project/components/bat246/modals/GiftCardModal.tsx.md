# `components/bat246/modals/GiftCardModal.tsx`

> Static placeholder modal for a BAT246 "Gift Card Shop" that lists two hardcoded $650 entry gift cards with non-functional Buy buttons.

**Kind:** React component · **Lines:** 60

## Purpose
Opened from the board toolbar's gift-card action. It describes buying a gift card that gives someone a free entry on the current board, but it is UI only: nothing is purchased.

## How it works
- Renders a fixed full-screen overlay (`z-50`) with a dark card.
- Maps over an inline array of two items, "At Bat Entry" and "Dugout Entry", both priced 650, and shows each with a Buy button that has no `onClick`.
- A footer strip shows `board.trackingNumber` and `board.minorLeagueAmount`.
- The header X and the Close button call `onClose`.

## Exports
- `GiftCardModal({ board, onClose }: { board: BoardData; onClose: () => void })` - the modal.

## Dependencies
- **Internal:** `components/bat246/types.ts` - `BoardData`.
- **Packages:** `lucide-react` - `X`, `Gift` icons.

## Used by
- `components/bat246/BoardLayout.tsx` and `components/bat246/BoardMobileSections.tsx`, when `openModal === "giftcard"`.

## Notes
- Stub: the Buy buttons do nothing and prices are hardcoded, not read from a product.
