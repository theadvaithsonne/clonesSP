# `hooks/webinar/useLiveLot.ts`

> Client hook that tracks the auction lot a host has pinned in a webinar room: it reads lot state, the bid feed, the viewer's Auction Wallet balance and win settlement over REST, and places bids.

**Kind:** React hook · **Lines:** 311

## Purpose
Webinar hosts can pin a product to the room and run a live auction on it. The auction itself lives on the external Garage Store backend, which orders bids atomically, applies anti-snipe extensions and settles lots on a cron. This hook is the room-side view of that lot. All numbers come from REST. The `nc:bid` LiveKit data channel, the room socket and a local window event only say "lot X changed, refetch". The hook takes just a product id because a lot is whatever the host pinned.

## How it works

### State
`auction` (`AuctionLot | null`), `bids` (newest-first `LotBid[]`), `bidding` (a bid is in flight), `win` (`AuctionWin | null`), `wallet` (`AuctionWalletBalance | null`) and `shortfallUsd`. Three refs mirror values so async code can read them before React re-renders:
- `lotIdRef`: the current `productId`, assigned on every render.
- `auctionRef`: the latest lot. `refreshLot` and the reset effect write it directly so the poll can choose its next delay straight away.
- `biddingRef`: guards against double-submitting a bid.

### Reading the lot (`refreshLot`)
Runs `fetchAuctionLot(id)` and `fetchBidHistory(id)` together with `Promise.allSettled`. It drops the result if `lotIdRef.current` has moved to another lot by then. A failed or empty lot read leaves the existing `auction` in place, so a brief network error does not blank a live auction. The bid feed is replaced only when its request succeeds.

### Lot lifecycle effects
1. **Reset on `productId` change.** Clears auction, bids, win and shortfall (and `auctionRef`) before the first read of the new lot. Without this, a newly pinned item could show the previous item's winner, price or bid feed. A null id retires the lot.
2. **Wallet read.** Calls `refreshWallet()` once per lot. Signed-out viewers get `null`. Errors are swallowed because the balance is only a hint: the backend's 402 response is what actually blocks a bid.
3. **Self-scheduling poll.** A `setTimeout` chain (not an interval) whose delay comes from `auctionRef`: `LOT_POLL_MS` (3s) while a lot exists, `IDLE_POLL_MS` (15s) while the pin has no auction round yet (a plain Buy Now pin, or one the host has not started), and it stops once `isSettled(status)` is true. It reads status through the ref so that each poll result does not rebuild the timer.
4. **Ping listener.** Listens on `window` for `AUCTION_PING_EVENT` (`"webinar:auction-ping"`). A ping for this product, or a ping with no product id, triggers an immediate `refreshLot`. A ping for a different product is ignored.
5. **Win settlement.** Runs only when the viewer is signed in and `auction.status === "sold"`. It polls `fetchAuctionWin` and retries every `WIN_RETRY_MS` (5s) while the result has `status === "pending"`. When a call throws, it retries up to `WIN_MAX_FAILURES` (3) times and then stops. Winning involves no payment step: the bid already escrowed money from the Auction Wallet, and the store captures it at close. The win result only shows whether that capture went through.

### Placing a bid (`bid(amount)`)
- Returns early if there is no lot or a bid is already in flight. Signed-out viewers get a toast: "Sign in to bid ...".
- Calls `placeBid(id, amount)`, which escrows the amount against the prepaid Auction Wallet. There is no card sheet.
- On success it shows `newHighest` and `bidCount + 1` straight away, then the authoritative refetch overwrites them. If `binHit` (the bid reached the buy-it-now price) it toasts "You won it — auction ended!". It then calls `onBidPlaced(id)` so the room refetches immediately, then runs `refreshLot` and `refreshWallet`.
- An `InsufficientAuctionBalanceError` sets `shortfallUsd` (the caller shows a top-up prompt) and does not refetch or toast. Any other error refetches the lot and toasts the message, falling back to "Someone may have outbid you — try again."

## Exports
- `useLiveLot({ productId, authed, onBidPlaced? }): LiveLot` - the hook. `productId` is the pinned lot (or null), `authed` says whether the viewer is signed in, and `onBidPlaced(productId)` is an optional callback that fans a successful bid out to the room.
- `interface LiveLot` - `{ auction, bids, bidding, win, wallet, bid(amount), shortfallUsd, clearShortfall(), refresh() }`. `refresh` re-reads the current lot now.
- `AUCTION_PING_EVENT` - re-exported from `lib/webinar/bid-channel.ts` (`"webinar:auction-ping"`).

## Interfaces
- **Backend endpoints called** (through the helper modules):
  - `GET /backend/wallet/auction/balance` (in this repo, `server/routes/wallet.ts`, `requireAuth`) - Auction Wallet balance.
- **External services:** Garage Store backend at `STORE_API_URL` (`NEXT_PUBLIC_STORE_API_URL`, then `NEXT_PUBLIC_ECOMMERCE_API_URL`, defaulting to `https://ecommerce.networkchains.com`):
  - `GET /storefront/marketplace/products/:id` - lot state (`fetchAuctionLot`)
  - `GET /products/:id/bids` - bid history (`fetchBidHistory`)
  - `POST /products/:id/bids` - place a bid with a Bearer token; answers 402 `INSUFFICIENT_AUCTION_BALANCE` when the wallet is short (`placeBid`)
  - `GET /products/:id/auction-win` - the viewer's win settlement (`fetchAuctionWin`)
- **Browser events:** listens for the `window` event `webinar:auction-ping`.
- **Background work:** a 3s/15s lot poll and a 5s win-retry poll, both cleared on unmount or when the product changes.

## Dependencies
- **Internal:** `lib/api/auctionLot.ts` - `fetchAuctionLot`, `fetchBidHistory`, `fetchAuctionWin`, `isSettled` and types · `lib/api/auctions.ts` - `placeBid`, `InsufficientAuctionBalanceError` · `lib/api/auctionWallet.ts` - `getAuctionWalletBalance` · `lib/webinar/bid-channel.ts` - `AUCTION_PING_EVENT`.
- **Packages:** `react` - state, refs, effects · `sonner` - toasts.

## Used by
- `app/webinar/[id]/WebinarRoomClient.tsx` (the webinar room page). It passes `announceLotChange` as `onBidPlaced`.

## Notes
- `fetchAuctionWin` returns `null` rather than throwing on a non-OK response, so `WIN_MAX_FAILURES` only limits retries after network-level exceptions. A 404 resolves to `win = null` and is not retried.
- The cron that closes a lot sends no ping. The 3s poll is the only thing that moves a lot from live to settled for viewers who do not bid.
- After a bid, the room is notified before this client's own refetch on purpose, so other viewers start their refetch while this one is still in flight.
