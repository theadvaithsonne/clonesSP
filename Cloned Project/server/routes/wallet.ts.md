# `server/routes/wallet.ts`

> Express router with 51 endpoints, mounted at `/wallet`.

**Kind:** Express router · **Lines:** 3063 · **Mounted at:** `/wallet` (browser: `/backend/wallet`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (51)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| GET | `/store/balance` | `/backend/wallet/store/balance` | `requireAuth` | inline | 77 |
| GET | `/store/transactions` | `/backend/wallet/store/transactions` | `requireAuth` | inline | 110 |
| POST | `/store/credit` | `/backend/wallet/store/credit` | `requireAuth`, `requireOrgAdmin` | inline | 169 |
| GET | `/store/currencies` | `/backend/wallet/store/currencies` | `requireAuth` | inline | 263 |
| GET | `/store/fx-quote` | `/backend/wallet/store/fx-quote` | `requireAuth` | inline | 347 |
| POST | `/store/convert/preview` | `/backend/wallet/store/convert/preview` | `requireAuth` | inline | 411 |
| GET | `/store/conversion-fees` | `/backend/wallet/store/conversion-fees` | `requireAuth` | inline | 546 |
| GET | `/store/conversion-fee` | `/backend/wallet/store/conversion-fee` | `requireAuth` | inline | 615 |
| PUT | `/store/conversion-fees` | `/backend/wallet/store/conversion-fees` | `requireAuth` | inline | 666 |
| GET | `/store/conversion-fees/earnings` | `/backend/wallet/store/conversion-fees/earnings` | `requireAuth` | inline | 776 |
| GET | `/store/rates` | `/backend/wallet/store/rates` | `requireAuth` | inline | 857 |
| GET | `/store/transfer/:transferGroupId` | `/backend/wallet/store/transfer/:transferGroupId` | `requireAuth` | inline | 917 |
| GET | `/store/limits` | `/backend/wallet/store/limits` | `requireAuth` | inline | 1043 |
| POST | `/store/convert` | `/backend/wallet/store/convert` | `requireAuth` | inline | 1067 |
| POST | `/store/transfer-multi` | `/backend/wallet/store/transfer-multi` | `requireAuth` | inline | 1130 |
| POST | `/store/transfer` | `/backend/wallet/store/transfer` | `requireAuth` | inline | 1196 |
| POST | `/store/topup` | `/backend/wallet/store/topup` | `requireAuth` | inline | 1306 |
| GET | `/store/topup-address` | `/backend/wallet/store/topup-address` | `requireAuth` | inline | 1375 |
| GET | `/store/topup-transactions` | `/backend/wallet/store/topup-transactions` | `requireAuth` | inline | 1514 |
| GET | `/auction/balance` | `/backend/wallet/auction/balance` | `requireAuth` | inline | 1635 |
| GET | `/auction/transactions` | `/backend/wallet/auction/transactions` | `requireAuth` | inline | 1659 |
| GET | `/auction/locks` | `/backend/wallet/auction/locks` | `requireAuth` | inline | 1710 |
| POST | `/auction/topup` | `/backend/wallet/auction/topup` | `requireAuth` | inline | 1735 |
| GET | `/store/transfer-targets` | `/backend/wallet/store/transfer-targets` | `requireAuth` | inline | 1784 |
| GET | `/store/org-wallets` | `/backend/wallet/store/org-wallets` | `requireAuth`, `requireOrgAdmin` | inline | 1863 |
| GET | `/affiliate/balance` | `/backend/wallet/affiliate/balance` | `requireAuth` | inline | 1908 |
| GET | `/affiliate/transactions` | `/backend/wallet/affiliate/transactions` | `requireAuth` | inline | 1935 |
| GET | `/affiliate/transactions/:transactionId` | `/backend/wallet/affiliate/transactions/:transactionId` | `requireAuth` | inline | 1981 |
| POST | `/affiliate/transfer-to-store` | `/backend/wallet/affiliate/transfer-to-store` | `requireAuth` | inline | 2025 |
| GET | `/content-rewards/balance` | `/backend/wallet/content-rewards/balance` | `requireAuth` | inline | 2115 |
| GET | `/content-rewards/transactions` | `/backend/wallet/content-rewards/transactions` | `requireAuth` | inline | 2148 |
| POST | `/content-rewards/transfer` | `/backend/wallet/content-rewards/transfer` | `requireAuth` | inline | 2201 |
| GET | `/all` | `/backend/wallet/all` | `requireAuth` | inline | 2266 |
| GET | `/store/all` | `/backend/wallet/store/all` | `requireAuth` | inline | 2316 |
| GET | `/purchases` | `/backend/wallet/purchases` | `requireAuth` | inline | 2342 |
| GET | `/` | `/backend/wallet` | `requireAuth`, `requireFounder` | inline | 2401 |
| POST | `/create-order` | `/backend/wallet/create-order` | `requireAuth`, `requireFounder` | inline | 2427 |
| POST | `/verify-payment` | `/backend/wallet/verify-payment` | `requireAuth`, `requireFounder` | inline | 2444 |
| GET | `/internal/balance` | `/backend/wallet/internal/balance` | `requireInternalKey` | inline | 2492 |
| POST | `/internal/deduct` | `/backend/wallet/internal/deduct` | `requireInternalKey` | inline | 2519 |
| GET | `/bank-details` | `/backend/wallet/bank-details` | `requireAuth` | inline | 2558 |
| POST | `/bank-details` | `/backend/wallet/bank-details` | `requireAuth` | inline | 2573 |
| GET | `/accounts` | `/backend/wallet/accounts` | `requireAuth` | inline | 2665 |
| POST | `/accounts` | `/backend/wallet/accounts` | `requireAuth` | inline | 2694 |
| GET | `/withdrawable` | `/backend/wallet/withdrawable` | `requireAuth` | inline | 2727 |
| GET | `/withdrawal-fees` | `/backend/wallet/withdrawal-fees` | `requireAuth` | inline | 2772 |
| GET | `/withdrawal-preference` | `/backend/wallet/withdrawal-preference` | `requireAuth` | inline | 2833 |
| PUT | `/withdrawal-preference` | `/backend/wallet/withdrawal-preference` | `requireAuth` | inline | 2873 |
| GET | `/withdrawals` | `/backend/wallet/withdrawals` | `requireAuth` | inline | 2933 |
| DELETE | `/accounts/:id` | `/backend/wallet/accounts/:id` | `requireAuth` | inline | 2981 |
| GET | `/store/all-currencies` | `/backend/wallet/store/all-currencies` | `requireAuth` | inline | 3010 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 3062 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `find`, `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
  - `GarageAdminModel` (server/models/garageAdmin.model.ts) — reads: `exists`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `findOne`
  - `AivatarWalletTransaction` (server/models/aivatarWalletTransaction.model.ts) — reads: `find`
  - `OpenClawAgent` (server/models/openclawAgent.model.ts) — reads: `findOne`
  - `BankDetails` (server/models/bank-details.model.ts) — reads: `findOne`; **writes:** `findOneAndUpdate`
- **Environment variables (`process.env`):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

## Dependencies

- **Internal:**
  - `server/middleware/auth.ts` — `requireAuth`, `requireFounder`
  - `server/middleware/roles.ts` — `requireOrgAdmin`
  - `server/models/user.model.ts` — `User`
  - `server/models/bank-details.model.ts` — `BankDetails`
  - `server/services/wallet.ts` — `getOrCreateStoreWallet`, `getStoreWalletBalance`, `getUserStoreWallets`, `creditStoreWallet`, `transferStoreCreditsBetweenOrgs`, `transferStoreToContentRewards`, `getOrCreateAffiliateWallet`, `getAffiliateWalletBalanceWithGating`, … +11
  - `server/services/cryptoFxRate.ts` — `TRANSFERABLE_CURRENCIES`, `convertBetween`, `getUsdPerCoin`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/cryptobrandWallets.ts` — `ensureCryptobrandWallets`
  - `server/config/cryptobrandCurrencies.ts` — `CRYPTOBRAND_ALL_CURRENCIES`
  - `server/services/auctionWallet.ts` — `getOrCreateAuctionWallet`, `getAuctionWalletBalance`, `getAuctionWalletTransactions`, `getAuctionWalletLocks`, `createAuctionWalletTopupInvoice`, `AUCTION_WALLET_TOPUP_MIN_CENTS`, `AUCTION_WALLET_TOPUP_MAX_CENTS`
  - `server/models/auctionWalletTransaction.model.ts` — `AUCTION_WALLET_TX_TYPES`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/services/contentRewardsWallet.ts` — `getOrCreateContentRewardsWallet`, `getContentRewardsWalletBalance`, `getContentRewardsBalanceForOrg`, `listContentRewardsBalancesForUser`, `getContentRewardsWalletTransactions`, `transferEarningsToUserWallet`
  - `server/services/walletAccount.ts` — `getWalletAccounts`, `upsertWalletAccount`, `deleteWalletAccount`
  - `server/models/walletAccount.model.ts` — `WALLET_ACCOUNT_WALLET_TYPES`, `CRYPTO_NETWORKS`
  - `server/services/withdrawal.ts` — `getUserWithdrawals`, `getWithdrawableBalanceCents`
  - `server/models/withdrawal.model.ts` — `WITHDRAWAL_WALLET_TYPES`
  - `server/services/affiliateTransactionDetail.ts` — `getAffiliateTransactionDetail`
  - `server/config/affiliateWithdrawalFees.ts` — `resolveAffiliateFeeTier`
  - `server/middleware/auth.ts` — `requireInternalKey`
  - `server/models/openclawAgent.model.ts` — `OpenClawAgent`
  - `server/services/aivatarWallet.service.ts` — `getOrCreateAivatarWallet`, `addAivatarCredits`, `deductAivatarCreditsWithDebt`
  - `server/models/aivatarWalletTransaction.model.ts` — `AivatarWalletTransaction`
- **Packages:**
  - `express` — `Router`
  - `zod` — `z`
  - `mongoose`
  - `razorpay`
  - `crypto`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/wallet`.

## Notes

- Large file (3063 lines) — read it by section; line numbers above point into it.
