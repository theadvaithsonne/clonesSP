# `server/services/walletAccount.ts`

> src/services/walletAccount.ts Thin service for per-wallet payout accounts (bank + crypto).

**Kind:** backend service · **Lines:** 88

<!-- docgen:auto -->

## Purpose
src/services/walletAccount.ts
Thin service for per-wallet payout accounts (bank + crypto).
Mirrors the upsert pattern from the legacy /wallet/bank-details handler,
keyed by the wallet slot { userId, walletType, orgId, accountType }.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `getWalletAccounts` | function | `async getWalletAccounts(userId: string, walletType: WalletAccountWalletType, orgId?: string \| null): Promise<any[]>` — All accounts (≤2) for a given wallet slot, belonging to the user. | 24 |
| `upsertWalletAccount` | function | `async upsertWalletAccount(params: { userId: string; walletType: WalletAccountWalletTy…): Promise<any>` — Upsert one account by its wallet slot key. | 41 |
| `deleteWalletAccount` | function | `async deleteWalletAccount(userId: string, accountId: string): Promise<boolean>` — Delete an account, scoped to the owning user. | 70 |
| `getAllWalletAccountsForUser` | function | `async getAllWalletAccountsForUser(userId: string): Promise<any[]>` — Admin/read helper: every account for a user across all wallets. | 83 |

## Interfaces

- **Database (Mongoose models used):**
  - `WalletAccount` (server/models/walletAccount.model.ts) — reads: `find`; **writes:** `findOneAndUpdate`, `deleteOne`

## Dependencies

- **Internal:**
  - `server/models/walletAccount.model.ts` — `WalletAccount`, `WalletAccountWalletType`, `WalletAccountType`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/controllers/garageAdmin.controller.ts`
- `server/routes/wallet.ts`
