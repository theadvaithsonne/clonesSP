# `lib/api/auctionLot.ts`

> The read side of live auctions in the webinar room: fetches lot state, bid history and win/settlement status from the external Garage Store (ecommerce) backend, and normalises them into an `AuctionLot`.

**Kind:** frontend library · **Lines:** 330

## Purpose
A host can auction a storefront product during a live webinar. The products, bids and lot state all live on the **Garage Store backend**, an external service separate from this repo's Express server. The file header says it is deliberately wire-identical to the storefront app's own `lib/api/auctionLot.ts`, so store visitors and webinar viewers see the same numbers. The store backend decides everything: it orders bids in one Mongo transaction, applies anti-snipe protection and settles lots on a cron. This client only reads. The LiveKit data-channel message `nc:bid` only signals "this lot changed, refetch it".

## How it works

### Configuration
`STORE_API_URL` is `NEXT_PUBLIC_STORE_API_URL`, falling back to `NEXT_PUBLIC_ECOMMERCE_API_URL` and then `https://ecommerce.networkchains.com`. `lib/api/auctions.ts` reuses it.

### Money model (from the header comment)
Bids are backed by a prepaid **Auction Wallet**: one USD balance per buyer, held on the main Garage backend (see `lib/api/auctionWallet.ts`). Placing a bid escrows funds against that wallet in the same write that orders the bid; a bid the wallet can't cover is refused with HTTP 402. When the lot closes, the winner's escrow is captured and losers' escrows are released. There is **no winner checkout**, so the win-time UI is only a read (`fetchAuctionWin`).

### Helpers
- `nextBidAmount(lot)`: the minimum next bid. That is `currentBid + minBidIncrement` once there are bids, otherwise `startPrice`.
- `isAuctionProduct(p)`: true for `saleType` `auction` or `hybrid_auction`, **or** whenever `auction.status` exists. A live-session round leaves `saleType` as `buy_now`, so the subdocument is the only signal.
- `isSettled(status)`: true for `sold`, `unsold`, `ended` and `cancelled`.

### `fetchAuctionLot(productId)`
- Calls `GET <store>/storefront/marketplace/products/:id`, a public request without a token.
- **Throws** on a non-OK response, so callers keep their last good state instead of blanking a live auction. Returns `null` when the product has no `_id`, or has neither `auction.status` nor `auction.endsAt` (a plain Buy Now item).
- Maps the product into an `AuctionLot`: title, first image, currency (product, then store, then `USD`), status (default `scheduled`), epoch-ms `startsAt`/`endsAt`, `startPrice`, `minBidIncrement` (default 1), `currentBid` (the highest bid when there are bids, otherwise the start price), `bidCount`, and `leaderUserId` from `highestBidderId`.
- **Clock skew:** it parses the HTTP `Date` response header and sets `clockSkewMs = serverDate - Date.now()`, measured before the extra leader-name request. Countdowns, and therefore whether the Bid button is shown, must use server time, or a device with a fast clock sees every short lot as already closed.
- **Leader name:** the state endpoint only carries the leader's id. `leaderNameFor` fetches the bid history and takes the bidder name from the first `active` or `won` bid (or the newest bid). It caches the result per product and bid count in a module-level variable, so a poll only costs a second request when someone has actually bid. Errors are swallowed and the name stays `null`.

### `fetchBidHistory(productId)`
Calls `GET <store>/products/:id/bids`. The JWT is sent when one exists, because the backend unmasks bidder names for the seller only. Returns `[]` on any non-OK response. Maps `body.data.items` into `LotBid` objects (id, amount, currency, status, epoch-ms `at`, `bidderName`).

### `fetchAuctionWin(productId)`
Returns `null` immediately when there is no token. Calls `GET <store>/products/:id/auction-win` with the bearer token and accepts either `body.data` or the bare body. Returns `null` unless `won` is true. `paid` is treated as the fact: when `status` is missing it is derived as `settled` if paid, otherwise `pending`. Amount, currency, USD amount, settlement id, order id and invoice id are each nullable.

## Exports
- `STORE_API_URL: string` - Garage Store backend origin.
- `AuctionStatus` (type) - `scheduled | live | ended | sold | unsold | cancelled`.
- `AuctionLot` (interface) - normalised lot, including `clockSkewMs`.
- `LotBid` (interface) - one row of the bid feed.
- `AuctionSettlementStatus` (type) - `pending | settled | failed`.
- `AuctionWin` (interface) - settlement result for the caller.
- `nextBidAmount(lot: AuctionLot): number`
- `isAuctionProduct(p: { saleType?: string; auction?: { status?: string } }): boolean`
- `isSettled(status: AuctionStatus): boolean`
- `fetchBidHistory(productId: string): Promise<LotBid[]>`
- `fetchAuctionLot(productId: string): Promise<AuctionLot | null>`
- `fetchAuctionWin(productId: string): Promise<AuctionWin | null>`

## Interfaces
- **External services:** Garage Store backend (default `https://ecommerce.networkchains.com`):
  - `GET /storefront/marketplace/products/:id` - public lot state.
  - `GET /products/:id/bids` - bid history (JWT optional).
  - `GET /products/:id/auction-win` - the caller's settlement (JWT required).
- **Environment variables:** `NEXT_PUBLIC_STORE_API_URL`, `NEXT_PUBLIC_ECOMMERCE_API_URL` - store backend origin.
- **Browser storage / cookies:** reads `garage_tok` through `getToken()`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
- `app/webinar/[id]/WebinarRoomClient.tsx` - the webinar room (`/webinar/[id]`).
- `components/webinar/BidsPanel.tsx`, `components/webinar/LiveAuctionCard.tsx` - auction UI.
- `hooks/webinar/useLiveLot.ts` - polling and refetch hook.
- `lib/api/auctions.ts` - reuses `STORE_API_URL`.

## Notes
- The leader-name cache is one module-level slot, so watching two lots at once makes each request evict the other's cache entry. That costs extra requests but never shows a wrong name, because the cache is keyed on product id and bid count.
- None of these endpoints are served by this repo's `server/`.
