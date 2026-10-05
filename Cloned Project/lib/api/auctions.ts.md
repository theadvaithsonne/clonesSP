# `lib/api/auctions.ts`

> The write side of live auctions in the webinar room: place a bid, and (host only) start or cancel an auction round. All calls go to the external Garage Store backend.

**Kind:** frontend library · **Lines:** 182

## Purpose
Reads live in `lib/api/auctionLot.ts`. This file holds the authenticated writes the webinar room performs against the store backend: a viewer placing a bid, and the seller opening a round on one of their products or pulling a live lot.

## How it works
Every function requires a token from `getToken()` and throws a friendly "Sign in to ..." error when there isn't one. Each one POSTs to `STORE_API_URL` (imported from `auctionLot.ts`, with any trailing slash removed) with `cache: "no-store"`.

- **`placeBid(productId, amount)`** calls `POST /products/:id/bids` with `{ amount }`. The server does this in one transaction: it orders the bid, locks the escrow difference against the bidder's Auction Wallet and applies anti-snipe. There are three outcomes:
  - **402** with `code: "INSUFFICIENT_AUCTION_BALANCE"`: throws `InsufficientAuctionBalanceError` with `requiredUsd`, `availableUsd` and `shortfallUsd`. The shortfall is **rounded up to the cent**, so a top-up of that amount can't leave the buyer $0.01 short.
  - Any other non-OK response, typically 409 when someone bid first: throws an `Error` with the server's message or "Someone may have outbid you, try again."
  - Success: returns `body.data` (or the bare body) as a `PlaceBidResult`. That includes the bid, `binHit` (the bid triggered Buy-It-Now and closed the lot), `newHighest`, and optional `escrow` and `wallet` snapshots.
- **`startAuctionRound(productId, { startPrice, minBidIncrement, durationSec })`** calls `POST /products/:id/round`. Prices are major units in the product's own currency, never cents. There is no separate lot document; the product itself is the auction. The server writes a fresh `auction` subdocument and clears what the previous round left (highest bidder, winning bid, settlement, reserve and Buy-It-Now price). It refuses with 409 if a previous round still has live escrow. `saleType` is left unchanged, so the item stays a Buy Now listing on the storefront. Only the seller's own org may call this; others get 403. Errors pass through the server's message (important for the different 409 cases), falling back to "Only the seller can auction this item" on 403 or "Couldn't start the auction".
- **`cancelAuction(productId)`** calls `POST /products/:id/auction/cancel`. The server releases every escrow held on the lot. Returns `{ cancelled, refundedCount, refundedUsd }`. Seller only.

## Exports
- `Bid` (interface) - a bid row (`_id`, `amount`, `currency`, `status`, `createdAt`, `bidderName?`).
- `PlaceBidResult` (interface) - `{ bid, binHit, newHighest, escrow?, wallet? }`.
- `InsufficientAuctionBalanceError` (class, extends `Error`) - `code = "INSUFFICIENT_AUCTION_BALANCE"`, read-only `requiredUsd`, `availableUsd` and `shortfallUsd`. Its message tells the user how much to add.
- `placeBid(productId: string, amount: number): Promise<PlaceBidResult>`
- `AuctionRoundConfig` (interface) - `{ startPrice, minBidIncrement, durationSec }`.
- `startAuctionRound(productId: string, config: AuctionRoundConfig): Promise<void>`
- `cancelAuction(productId: string): Promise<{ cancelled: boolean; refundedCount: number; refundedUsd: number }>`

## Interfaces
- **External services:** Garage Store backend (`STORE_API_URL`, default `https://ecommerce.networkchains.com`):
  - `POST /products/:id/bids` - place a bid.
  - `POST /products/:id/round` - start an auction round (seller).
  - `POST /products/:id/auction/cancel` - cancel a live lot (seller).
- **Environment variables:** inherited through `STORE_API_URL` (`NEXT_PUBLIC_STORE_API_URL` / `NEXT_PUBLIC_ECOMMERCE_API_URL`).
- **Browser storage / cookies:** reads `garage_tok` through `getToken()`.

## Dependencies
- **Internal:** `lib/api/auctionLot.ts` - `STORE_API_URL`. `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
- `app/webinar/[id]/WebinarRoomClient.tsx` - the webinar room (`/webinar/[id]`).
- `components/webinar/ControlBar.tsx`, `components/webinar/ProductPickerDialog.tsx` - the host's controls to start or cancel a round.
- `hooks/webinar/useLiveLot.ts` - bidding.

## Notes
- The client should send exactly the amount the Bid button showed (see `nextBidAmount` in `auctionLot.ts`). The server rejects amounts it no longer accepts, and the UI is expected to refetch.
- `InsufficientAuctionBalanceError.shortfallUsd` is meant to pre-fill the top-up modal (`lib/api/auctionWallet.ts`).
