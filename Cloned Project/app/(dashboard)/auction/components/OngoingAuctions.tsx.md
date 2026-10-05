# `app/(dashboard)/auction/components/OngoingAuctions.tsx`

> Paginated grid of auction cards for the Auction page, with Edit and Cancel controls shown only to each auction's creator.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 221

## Purpose
This component renders the "Ongoing Auction" tab of `/auction`. It shows the auctions its parent passes in. It does not fetch or subscribe to anything itself; the parent page handles that. It renders the cards, splits them into pages, and calls the backend directly in only one case: when the creator cancels an auction.

## How it works
- **`timeLeft(endTime)`:** returns `"Ended"` when the end time has passed. Otherwise it returns `"Xh Ym left"`, or `"Ym left"` when less than an hour remains. The value is computed at render time only; there is no ticking timer, so it refreshes only when the component re-renders.
- **`AuctionCard` (internal):**
  - shows a 4:3 image area using the first entry in `productImages`, or a `Gavel` placeholder;
  - an overlay badge shows either `timeLeft` or "Ended";
  - below it: product name, `creatorOrgName · creatorName`, and the minimum bid as `currency minPrice.toLocaleString()`;
  - owners see Edit and Cancel buttons. Both are disabled once the auction has ended, and Cancel is also disabled while the request is in flight (local `cancelling` state).
- **Pagination:** `PAGE_SIZE = 8`.
  - `safePage` caps the stored page at `totalPages`, so the view stays valid when the list shrinks.
  - The page numbers are all rendered as buttons, with Prev and Next on either side.
  - The pagination controls and the "Page X of Y" label appear only when there is more than one page.
- **Grid:** 1, 2, 3 or 4 columns depending on screen width (Tailwind `sm`/`lg`/`xl`).
- **Ownership:** a card counts as owned when `currentUserId` is set and equals `auction.createdBy`.
- **Cancel flow (`handleCancel`):**
  1. calls `cancelAuction(id)`, which sends `PATCH /backend/auctions/:id/cancel`;
  2. calls `onAuctionRemove(updated._id)`;
  3. if removing that auction leaves the current page past the last page, steps back one page;
  4. on error, only logs `[Auction] cancel failed:`; the user sees nothing.
- **Empty state:** "No ongoing auctions right now." with a hint to use the Auction tab.

## Exports
- `default OngoingAuctions(props)`: the props are:
  - `auctions: IAuction[]`: the list to display;
  - `currentUserId: string | null`: used to decide ownership;
  - `onEdit(auction)`: the parent opens `StartAuctionDialog` in edit mode;
  - `onAuctionUpdate(auction)`: accepted but never used inside this component;
  - `onAuctionRemove(auctionId)`: the parent removes the auction from its list.

## Interfaces
- **Backend endpoints called:** `PATCH /backend/auctions/:id/cancel`. The backend checks that the caller created the auction and that it is still `ongoing`, sets `status = "cancelled"`, and broadcasts `auction:end` to the room `auction:global`.

## Dependencies
- **Internal:** `lib/auction-api.ts` (`cancelAuction` and the `IAuction` type).
- **Packages:** `react` (`useState`); `lucide-react` (`Gavel`, `ChevronLeft`, `ChevronRight`).

## Used by
- `app/(dashboard)/auction/page.tsx`

## Notes
- After a cancel, the auction is removed twice: by the `onAuctionRemove` callback here and by the page's `auction:end` socket listener. Both use a filter, so the second removal does nothing.
- Expired auctions stay in the list until something removes them. The backend never marks auctions `ended`.
