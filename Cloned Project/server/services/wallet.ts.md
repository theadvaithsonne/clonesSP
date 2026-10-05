# `server/services/wallet.ts`

> Module exporting `computeAffiliateOutflowFee`, `creditPlatformAffiliateOutflowFee`, `getOrCreateStoreWallet`, `getStoreWalletBalance` and 22 more.

**Kind:** backend service · **Lines:** 3352

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AFFILIATE_OUTFLOW_FEE_PERCENT` | const | `= 5` | 50 |
| `AffiliateOutflowFeeSplit` | interface |  | 52 |
| `computeAffiliateOutflowFee` | function | `computeAffiliateOutflowFee(grossUsd: number): AffiliateOutflowFeeSplit` — Given a gross USD amount being transferred OUT of an affiliate wallet, carve the platform fee and return the split. | 67 |
| `creditPlatformAffiliateOutflowFee` | function | `async creditPlatformAffiliateOutflowFee(params: { senderUserId: string; feeUsd: number; session?: m…): Promise<{ wallet: any; transaction: any; } \| null>` — Credit the platform (Shorupan's PLATFORM_ORG_ID StoreWallet) with the fee side of an affiliate-outflow transfer. | 94 |
| `getOrCreateStoreWallet` | function | `async getOrCreateStoreWallet(userId: string, orgId: string): Promise<any>` — Get or create a store wallet for a user in an organization | 200 |
| `getStoreWalletBalance` | function | `async getStoreWalletBalance(userId: string, orgId: string, currency: string = "USD"): Promise<{ balance: number; currency: string } \| n…` — Get store wallet balance for a user in an organization | 227 |
| `getUserStoreWallets` | function | `async getUserStoreWallets(userId: string): Promise<any[]>` — Get all store wallets for a user across all organizations | 247 |
| `creditStoreWallet` | function | `async creditStoreWallet(founderId: string, stakeholderUserId: string, orgId: string, amount: number, description: string, note?: string): Promise<{ wallet: any; transaction: any }>` — Credit amount to a stakeholder's store wallet (founder only action) Uses MongoDB transaction for atomicity | 257 |
| `creditStoreWalletExternal` | function | `async creditStoreWalletExternal(input: { userId: string; orgId: string; amount: number; cur…): Promise<{ wallet: any; transaction: any; replayed…` — Credit a store wallet on behalf of an external partner (third-party API key). | 366 |
| `debitStoreWallet` | function | `async debitStoreWallet(userId: string, orgId: string, amount: number, description: string, relatedUserId?: string, note?: string, currency: string = "USD", metadata?: Record<string, any>): …` — Debit amount from store wallet (for future use) | 473 |
| `transferStoreCredits` | function | `async transferStoreCredits(senderId: string, recipientId: string, orgId: string, amount: number, description?: string): Promise<{ senderWallet: any; recipientWallet: any…` — Transfer credits between two users' store wallets within the SAME org. | 566 |
| `transferStoreCreditsBetweenOrgs` | function | `async transferStoreCreditsBetweenOrgs(senderId: string, recipientId: string, senderOrgId: string, recipientOrgId: string, amount: number, description?: string): Promise<{ senderWallet: any;…` — Transfer credits from the sender's store wallet (in `senderOrgId`) to the recipient's store wallet (in `recipientOrgId`). | 595 |
| `transferStoreToContentRewards` | function | `async transferStoreToContentRewards(senderId: string, recipientId: string, senderOrgId: string, destinationOrgId: string, amount: number, description?: string): Promise<{ senderWallet: any;…` — Peer transfer where the destination is the recipient's Content Rewards balance for a specific `destinationOrgId`. | 785 |
| `getOrCreateAffiliateWallet` | function | `async getOrCreateAffiliateWallet(userId: string): Promise<any>` — Get or create affiliate wallet for a user | 1000 |
| `getAffiliateWalletBalance` | function | `async getAffiliateWalletBalance(userId: string): Promise<{ balance: number; totalEarnings: number;…` — Get affiliate wallet balance for a user | 1017 |
| `getAffiliateWalletBalanceWithGating` | function | `async getAffiliateWalletBalanceWithGating(userId: string): Promise<{ balance: number; totalEarnings: number;…` — Get affiliate wallet balance with redemption gating based on Unilevel Plus purchase status. | 1042 |
| `debitAffiliateWallet` | function | `async debitAffiliateWallet(userId: string, amount: number, description: string, note?: string): Promise<{ wallet: any; transaction: any }>` — Debit the affiliate wallet (e.g., to pay an invoice using wallet balance). | 1220 |
| `transferAffiliateToStore` | function | `async transferAffiliateToStore(userId: string, orgId: string, amount: number, description?: string): Promise<{ affiliateWallet: any; storeWallet: any;…` — Transfer redeemable affiliate balance to the user's own store wallet. | 1297 |
| `creditAffiliateOrPlatform` | function | `async creditAffiliateOrPlatform(params: { recipientUserId: string; amount: number; currency…): Promise<{ affiliateWallet: any; transaction: any;…` — Credit affiliate wallet with commission, routing actual money to Shorupan if recipient has NOT purchased the Unilevel Plus Plan. | 1515 |
| `addCommission` | function | `async addCommission(userId: string, amount: number, description: string, relatedUserId?: string, metadata?: any): Promise<{ wallet: any; transaction: any }>` — Add commission to affiliate wallet (for future commission logic) | 2067 |
| `getStoreWalletTransactions` | function | `async getStoreWalletTransactions(userId: string, orgId: string, options: { limit?: number; offset?: number; type?: string; …): Promise<{ transactions: any[]; total: number }>` — Get transaction history for a store wallet | 2144 |
| `getAffiliateWalletTransactions` | function | `async getAffiliateWalletTransactions(userId: string, options: { limit?: number; offset?: number; type?: string; …): Promise<{ transactions: any[]; total: number }>` — Get transaction history for affiliate wallet | 2235 |
| `getAllUserWallets` | function | `async getAllUserWallets(userId: string): Promise<{ storeWallets: any[]; affiliateWallet: a…` — Get all wallets for a user (both store and affiliate). | 2302 |
| `getOrgStoreWallets` | function | `async getOrgStoreWallets(orgId: string, options: { limit?: number; offset?: number; } = {}): Promise<{ wallets: any[]; total: number }>` — Get all stakeholders' store wallets for an organization (founder use) | 2351 |
| `getOrgFounder` | function | `async getOrgFounder(orgId: string): Promise<string \| null>` — Find the founder of an organization | 2380 |
| `getUserPurchaseHistory` | function | `async getUserPurchaseHistory(userId: string, orgId: string, options: { limit?: number; offset?: number; type?: "all" \| …): Promise<{ purchases: any[]; total: number; }>` — Get user's purchase history (combined courses and products) | 2413 |
| `STORE_WALLET_TOPUP_MIN_CENTS` | const | `= 100` | 2572 |
| `STORE_WALLET_TOPUP_MAX_CENTS` | const | `= 1_000_000` | 2573 |
| `createStoreWalletTopupInvoice` | function | `async createStoreWalletTopupInvoice(params: { userId: string; orgId: string; amountCents: numbe…): Promise<{ invoice: any; payUrl: string }>` — Issue an invoice that, when paid, credits `amountCents` USD to the caller's per-org StoreWallet for `orgId`. | 2587 |
| `WalletTransferError` | class | `extends Error` | 2705 |
| `TransferBetweenWalletsResult` | interface |  | 2715 |
| `transferBetweenWallets` | function | `async transferBetweenWallets(params: { fromUserId: string; fromOrgId: string; fromCurren…): Promise<TransferBetweenWalletsResult>` | 2767 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`, `find`, `countDocuments`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`, `aggregate`, `find`, `countDocuments`; **writes:** `create`, `updateOne`
  - `OrgRewardsWallet` (server/models/orgRewardsWallet.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
  - `NcWallet` (server/models/ncWallet.model.ts) — reads: `findOne`; **writes:** `create`, `updateOne`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `findOne`
  - `CourseEnrollment` (server/models/courseEnrollment.model.ts) — reads: `find`
  - `ProductOrder` (server/models/productOrder.model.ts) — reads: `find`
  - `CallPurchase` (server/models/callPurchase.model.ts) — reads: `find`
- **Environment variables (`process.env`):** `FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`
  - `server/models/ncWallet.model.ts` — `NcWallet`
  - `server/models/orgRewardsWallet.model.ts` — `OrgRewardsWallet`
  - `server/models/user.model.ts` — `User`
  - `server/models/courseEnrollment.model.ts` — `CourseEnrollment`
  - `server/models/course.model.ts` — `Course`
  - `server/models/productOrder.model.ts` — `ProductOrder`
  - `server/models/callPurchase.model.ts` — `CallPurchase`
- **Packages:**
  - `mongoose`

## Used by

- `scripts/migrate-nc-wallets-to-store-vault.ts`
- `server/controllers/garageAdmin.controller.ts`
- `server/routes/bond.ts`
- `server/routes/contentCampaign.ts`
- `server/routes/ecommerceWallet.ts`
- `server/routes/hifiInvoice.ts`
- `server/routes/invoice.ts`
- `server/routes/thirdPartyWallet.ts`
- `server/routes/wallet.ts`
- `server/routes/walletHq.ts`
- `server/scripts/reconcile-franchise-floor-credits.ts`
- `server/services/bondCommission.ts`
- `server/services/commission.ts`
- `server/services/conversionFee.ts`
- `server/services/cryptosubAddonPurchase.ts`
- `server/services/cryptosubMonthlyBonus/payout.ts`
- `server/services/founderSubMonthlyBonus/payout.ts`
- `server/services/invoice.ts`
- `server/services/jobRewards.ts`
- `server/services/officeAddonSubscription.ts`
- `server/services/officeProInvoiceCommission.ts`
- `server/services/officeSubscription.ts`
- `server/services/pendingCouponGift.ts`
- `server/services/pendingReserveAssignment.ts`
- `server/services/rankBonus/payout.ts`
- _…and 4 more_

## Notes

- Large file (3352 lines) — read it by section; line numbers above point into it.
