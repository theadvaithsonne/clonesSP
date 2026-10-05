# `app/(dashboard)/auction/page.tsx`

> Global Auction screen: a header with the current user, a tab for starting an auction, and a live-updating tab of ongoing auctions fed by REST plus Socket.IO.

**Kind:** Next.js page · **Lines:** 170 · **Route:** `/auction`

## Purpose
This page lets any signed-in member list a product for auction. The product can come from their Garage store or from outside. Auctions are global: every user sees them. The page also shows every ongoing auction in real time. It renders in two ways: as its own Next.js route, and embedded as the "Auction" app inside the dashboard layout.

## How it works
**User header.** The page uses `useAmIFounder()` only for `userData` (name, email, avatar, org name, userId) and its `loading` flag. Despite the hook's name, the founder check itself is never used, so the page is not limited to founders. Initials for the avatar fallback come from the display name, which is the first of `name`, `email`, or `"User"`.

**State.** The page holds:
- `auctions`: the list of `IAuction` objects;
- `fetchingAuctions`;
- `dialogOpen`;
- `editTarget`: the auction being edited, or `null` when creating a new one;
- `activeTab`: `"start"` or `"ongoing"`.

**Realtime and initial load (one `useEffect` on mount):**
1. `connectSocket()`, then `socket.emit("auction:subscribe")`. The server responds by joining the socket to the room `auction:global` (see `server/realtime/socket.ts`).
2. Three listeners keep the list in sync:
   - `auction:new` adds the auction at the front unless it is already in the list;
   - `auction:update` replaces the auction with the same `_id`;
   - `auction:end` removes it.
3. `getAuctions()` (`GET /backend/auctions`) runs only after the page has subscribed, so no events are lost while the list loads. If the request fails, the list is set to empty.
4. On cleanup, the page emits `auction:unsubscribe` and removes the three listeners.

**Callbacks.**
- `handleAuctionSuccess(auction)` replaces the auction if it is already in the list, otherwise adds it at the front. It then switches to the "ongoing" tab. It is used after a create or edit in the dialog, and is also passed to `OngoingAuctions` as `onAuctionUpdate`.
- `handleAuctionRemove(id)` removes an auction from the list after a cancel.

**Tabs.**
- **Auction tab:** a call-to-action card. Its "+ Start Auction" button clears `editTarget` and opens the dialog. The button is disabled while the user is loading or has no `userId`.
- **Ongoing Auction tab:** the tab label shows a count. The tab renders `OngoingAuctions`, or "Loading auctions…" while the first fetch runs.

`StartAuctionDialog` is always mounted. It receives `editAuction={editTarget}` plus the creator's name and avatar, which are stored on the auction record.

## Exports
- `default AuctionPage()`: the page component (no props).

## Interfaces
- **Backend endpoints called:** `GET /backend/auctions` (through `lib/auction-api.ts`). The dialog and the cards also call `POST /backend/auctions`, `PUT /backend/auctions/:id`, `PATCH /backend/auctions/:id/cancel` and `GET /backend/auctions/my-products`.
- **Socket.IO events:** emits `auction:subscribe` and `auction:unsubscribe`. Listens for `auction:new`, `auction:update` and `auction:end`. The server broadcasts these to the room `auction:global` through `emitAuctionNew`, `emitAuctionUpdate` and `emitAuctionEnd` in `server/services/socket.ts`, called from `server/routes/auction.ts`.

## Dependencies
- **Internal:**
  - `lib/auction-api.ts`: `getAuctions` and the `IAuction` type;
  - `lib/socket.ts`: `connectSocket`. `getSocket` is imported but never used;
  - `lib/hooks/useAmIFounder.ts`: user and org data from `GET /backend/auth/me`;
  - `./components/StartAuctionDialog.tsx` and `./components/OngoingAuctions.tsx`;
  - `components/ui/tabs.tsx` and `avatar.tsx`.
- **Packages:** `react`; `lucide-react` (the `Gavel` icon).

## Used by
- `app/(dashboard)/layout.tsx`: imports it as `AuctionPage` and renders it for the inline app named `"Auction"`.
- It is also directly reachable at the Next.js route `/auction`.

## Notes
- The cleanup calls `socket.off(event)` without a handler, which removes **every** listener for those event names on the shared singleton socket, not only this page's listeners.
- No backend sweeper changes an auction's status to `ended` when `endTime` passes. Expired auctions stay `ongoing` and keep coming back from `GET /auctions`. Only the cards' "Ended" badge marks them. Only cancelling produces `auction:end`.
