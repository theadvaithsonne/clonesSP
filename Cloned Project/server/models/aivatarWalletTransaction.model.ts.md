# `server/models/aivatarWalletTransaction.model.ts`

> Mongoose model `AivatarWalletTransaction`: append-only ledger of credits, debits and debt clearances on AIvatar wallets, amounts in cents.

**Kind:** Mongoose model · **Lines:** 62

## Purpose
Provides an audit trail for every balance change on an `AivatarWallet`, including who made it (user, admin or system) and the resulting balance and debt. It was split out into its own collection (see the migration script listed under Used by).

## How it works
- `walletId` (ref `AivatarWallet`) and `orgId` (ref `Organization`) - required.
- `type` - `credit` | `debit` | `clear_debt`.
- `amount` - cents, always positive (`min: 0`).
- `balanceAfter`, `debtAfter` - cents snapshot after the change (`min: 0`).
- `source` - `user` | `admin` | `system`; `adminEmail` records the acting admin.
- `description` (required), `note` (optional).
- `idempotencyKey` - optional; unique sparse index so a retried operation cannot write twice.
- Only `createdAt` is kept (`updatedAt: false`), reflecting append-only use.
- Indexes: `{ orgId, createdAt -1 }`, `{ walletId, createdAt -1 }`, `{ createdAt -1 }`, `{ source, createdAt -1 }`, `{ adminEmail, createdAt -1 }`, and the unique sparse `idempotencyKey`.
- Explicit collection **`garage_aivatar_wallet_transactions`**.

## Exports
- `AivatarWalletTransaction` - Mongoose model.
- `interface IAivatarWalletTransaction` - document shape.
- `type AivatarWalletTransactionType` - `"credit" | "debit" | "clear_debt"`.
- `type AivatarWalletTransactionSource` - `"user" | "admin" | "system"`.

## Interfaces
- **Database:** `AivatarWalletTransaction` (collection `garage_aivatar_wallet_transactions`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/aivatarWalletTransaction.service.ts` - writes ledger rows.
- `server/routes/garageAdminWallets.ts` (mounted at `/garage-admin/wallets`) and `server/routes/wallet.ts` (mounted at `/wallet`) - list transactions.
- `server/scripts/migrate-wallet-transactions-to-collection.ts` - one-off migration (runs against `MONGODB_URI`, the production database).
