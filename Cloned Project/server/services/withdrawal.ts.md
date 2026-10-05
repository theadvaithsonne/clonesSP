# `server/services/withdrawal.ts`

> src/services/withdrawal.ts Admin-initiated withdrawal lifecycle.

**Kind:** backend service · **Lines:** 1285

<!-- docgen:auto -->

## Purpose
src/services/withdrawal.ts
Admin-initiated withdrawal lifecycle. The Withdrawal collection is the
canonical record; the wallet BALANCE is debited on initiate, refunded on
reject, kept on complete. The 5% fee is credited to the platform
(Shorupan) StoreWallet on completion. Amounts are CENTS; store/affiliate
balances are float USD, so we convert at the boundary. NcWallet is cents.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WithdrawalOverrides` | interface | A super admin's per-withdrawal overrides. | 86 |
| `lastSundayCutoff` | function | `lastSundayCutoff(now: Date = new Date()): Date` | 142 |
| `getWithdrawableBreakdown` | function | `async getWithdrawableBreakdown(userId: string, walletType: WithdrawalWalletType, orgId?: string \| null): Promise<{ balanceCents: number; withdrawableCents…` — The withdrawable cap, with the reasoning behind it. | 270 |
| `getWithdrawableBalanceCents` | function | `async getWithdrawableBalanceCents(userId: string, walletType: WithdrawalWalletType, orgId?: string \| null): Promise<number>` | 328 |
| `quoteWithdrawal` | function | `async quoteWithdrawal(params: { userId: string; walletType: WithdrawalWalletType;…)` — Price a withdrawal without writing anything. | 448 |
| `initiateWithdrawal` | function | `async initiateWithdrawal(params: { adminId: string; userId: string; walletType: With…): Promise<any>` | 528 |
| `completeWithdrawal` | function | `async completeWithdrawal(params: { adminId: string; withdrawalId: string; receiptUrl…): Promise<any>` | 710 |
| `rejectWithdrawal` | function | `async rejectWithdrawal(params: { adminId: string; withdrawalId: string; reason?: s…): Promise<any>` | 806 |
| `getUserWithdrawals` | function | `async getUserWithdrawals(userId: string, walletType: WithdrawalWalletType, orgId?: string \| null): Promise<any[]>` | 850 |
| `notifyAdminOnWithdrawalInitiated` | function | `async notifyAdminOnWithdrawalInitiated(withdrawalId: string \| Types.ObjectId): Promise<void>` — Notify the platform owner (Shorupan) that a withdrawal needs manual settlement. | 897 |
| `notifyUserOnWithdrawalInitiated` | function | `async notifyUserOnWithdrawalInitiated(withdrawalId: string \| Types.ObjectId): Promise<void>` — Email the user that their withdrawal request is queued for processing. | 1056 |
| `notifyUserOnWithdrawalCompleted` | function | `async notifyUserOnWithdrawalCompleted(withdrawalId: string \| Types.ObjectId): Promise<void>` — Email the user that their withdrawal has been settled / paid out. | 1110 |
| `notifyUserOnWithdrawalRejected` | function | `async notifyUserOnWithdrawalRejected(withdrawalId: string \| Types.ObjectId): Promise<void>` — Email the user that their withdrawal was declined and funds refunded. | 1233 |

## Interfaces

- **Database (Mongoose models used):**
  - `WithdrawalPreference` (server/models/withdrawalPreference.model.ts) — reads: `findOne`
  - `OrgRewardsWallet` (server/models/orgRewardsWallet.model.ts) — reads: `findOne`, `find`, `aggregate`; **writes:** `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `aggregate`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `NcWallet` (server/models/ncWallet.model.ts) — reads: `findOne`; **writes:** `updateOne`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`
  - `WalletAccount` (server/models/walletAccount.model.ts) — reads: `findOne`
  - `Withdrawal` (server/models/withdrawal.model.ts) — reads: `findById`, `find`; **writes:** `create`
  - `User` (server/models/user.model.ts) — reads: `findOne`
- **Environment via `server/config/env.ts`:** `env.FRONTEND_URL`

## Dependencies

- **Internal:**
  - `server/models/withdrawal.model.ts` — `Withdrawal`, `WithdrawalWalletType`
  - `server/models/walletAccount.model.ts` — `WalletAccount`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/ncWallet.model.ts` — `NcWallet`
  - `server/models/orgRewardsWallet.model.ts` — `OrgRewardsWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/models/garageAdmin.model.ts` — `GarageAdminModel`
  - `server/services/wallet.ts` — `getAffiliateWalletBalanceWithGating`, `creditStoreWallet`
  - `server/services/mailer.ts` — `sendMail`, `EMAIL_FROM_NOTIFICATION`
  - `server/models/withdrawalPreference.model.ts` — `WithdrawalPreference`
  - `server/config/affiliateWithdrawalFees.ts` — `resolveAffiliateFeeTier`, `AFFILIATE_KEEP_THRESHOLD_CENTS`, `PayoutMethod`
  - `server/config/env.ts` — `env`
- **Packages:**
  - `mongoose` — `ClientSession`, `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/ecommerceWallet.ts`
- `server/routes/garageAdminWithdrawalPreferences.ts`
- `server/routes/wallet.ts`
- `server/routes/walletHq.ts`
- `server/services/wallet.ts`
