# `server/services/auctionWallet.ts`

> src/services/auctionWallet.ts

**Kind:** backend service · **Lines:** 378

<!-- docgen:auto -->

## Purpose
src/services/auctionWallet.ts

Auction Wallet — the prepaid balance a buyer bids from. See the header on
models/auctionWallet.model.ts for the money model.

This file owns the garagenew half of the wallet:
  - read APIs (balance, transactions, locked breakdown)
  - money IN: top-up invoice creation, and the credit that runs when that
    invoice is paid (fulfillInvoice → case "auction_wallet_topup")

The escrow half — lock on bid, refund on outbid/loss, settle on win — is
owned by garage-store-backend/src/services/auctionEscrow.ts, because those
operations must be in the same Mongo transaction as the bid write. Both
backends share one replica set, so that is safe; keep the two in sync.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AUCTION_WALLET_TOPUP_MIN_CENTS` | const | `= 100` | 29 |
| `AUCTION_WALLET_TOPUP_MAX_CENTS` | const | `= 1_000_000` | 30 |
| `getOrCreateAuctionWallet` | function | `async getOrCreateAuctionWallet(userId: string \| mongoose.Types.ObjectId, session?: mongoose.ClientSession): Promise<any>` — Get or create the caller's auction wallet. | 41 |
| `getAuctionWalletBalance` | function | `async getAuctionWalletBalance(userId: string): Promise<{ balance: number; lockedBalance: number;…` — Read-only balance snapshot. | 66 |
| `getAuctionWalletTransactions` | function | `async getAuctionWalletTransactions(userId: string, options: { limit?: number; offset?: number; type?: string }…): Promise<{ transactions: any[]; total: number }>` — Ledger history. Same { limit, offset, type } contract and { transactions, total } shape as getStoreWalletTransactions. | 103 |
| `getAuctionWalletLocks` | function | `async getAuctionWalletLocks(userId: string): Promise<{ locks: any[]; totalLockedUsd: number; }>` — Per-auction breakdown of what this user currently has escrowed. | 132 |
| `creditAuctionWallet` | function | `async creditAuctionWallet(params: { userId: string; amountUsd: number; description: s…): Promise<{ wallet: any; transaction: any; alreadyC…` — Credit spendable balance. | 189 |
| `createAuctionWalletTopupInvoice` | function | `async createAuctionWalletTopupInvoice(params: { userId: string; amountCents: number; customerEmai…): Promise<{ invoice: any; payUrl: string }>` — Issue an invoice that credits the caller's auction wallet when paid. | 302 |

## Interfaces

- **Database (Mongoose models used):**
  - `AuctionWallet` (server/models/auctionWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `AuctionWalletTransaction` (server/models/auctionWalletTransaction.model.ts) — reads: `find`, `countDocuments`, `findOne`; **writes:** `create`
  - `AuctionEscrow` (server/models/auctionEscrow.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/auctionWallet.model.ts` — `AuctionWallet`
  - `server/models/auctionWalletTransaction.model.ts` — `AuctionWalletTransaction`, `AuctionWalletTxType`
  - `server/models/auctionEscrow.model.ts` — `AuctionEscrow`
- **Packages:**
  - `mongoose`

## Used by

- `server/routes/wallet.ts`
- `server/services/invoice.ts`
