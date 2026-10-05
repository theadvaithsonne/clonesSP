# `lib/api/auctionWallet.ts`

> A client for the Auction Wallet on the main Garage backend: read the prepaid USD balance and start a top-up through a Garage Invoice.

**Kind:** frontend library · **Lines:** 94

## Purpose
Live-auction bids escrow against a prepaid USD Auction Wallet: one balance per buyer that covers every store's auctions. Unlike products and bids, which live on the external store backend (see `lib/api/auctionLot.ts`), the wallet lives on **this repo's** Express backend, because it is a Garage-wide balance topped up with a Garage Invoice.

## How it works
- `walletFetch` is a private helper. It throws `"Sign in to use your Auction Wallet"` when there is no token. Otherwise it calls `${NEXT_PUBLIC_API_URL}<path>` with JSON headers, the bearer token and `cache: "no-store"`, and throws when the response isn't OK or the body has `success: false`. The error message uses `error`, then `message`, then `Request failed (<status>)`.
- `getAuctionWalletBalance()` reads the balance (the backend creates the wallet on first call) and fills defaults: 0 for missing numbers, `availableBalance` falling back to `balance`, currency `USD`, and `lastTransactionAt` null.
- `topupAuctionWallet(amountCents)` POSTs `{ amountCents }` (USD cents; the code comment gives the range as $1 to $10,000) and returns the created `invoice` and its hosted `payUrl`. The balance only arrives once that invoice is paid, after which the bidder returns to the room and bids again.
- **Balance semantics:** `balance` is the spendable figure. `lockedBalance` is money already moved into escrow for live bids and is *not* part of `balance`. Never add the two.

## Exports
- `AuctionWalletBalance` (interface) - `balance`, `lockedBalance`, `availableBalance`, `currency`, `exists`, `lastTransactionAt`.
- `getAuctionWalletBalance(): Promise<AuctionWalletBalance>`
- `AuctionTopupResult` (interface) - `{ invoice: { _id, invoiceNumber?, totalAmount?, itemCurrency?, status? }, payUrl }`.
- `topupAuctionWallet(amountCents: number): Promise<AuctionTopupResult>`

## Interfaces
- **Backend endpoints called:**
  - `GET /backend/wallet/auction/balance` - `requireAuth`. Served by `server/routes/wallet.ts` (mounted at `/wallet`).
  - `POST /backend/wallet/auction/topup` - `requireAuth`. Creates a top-up invoice.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL (fallback `http://localhost:4000`).
- **Browser storage / cookies:** reads `garage_tok` through `getToken()`.

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
- `components/webinar/AuctionTopUpModal.tsx` - the top-up modal.
- `components/webinar/LiveAuctionCard.tsx` - shows the balance next to the Bid button.
- `hooks/webinar/useLiveLot.ts`.

## Notes
- The file defines its own `API_URL` constant instead of importing it from `lib/api.ts`. Both read the same env var with the same fallback.
