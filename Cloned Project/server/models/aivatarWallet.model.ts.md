# `server/models/aivatarWallet.model.ts`

> Mongoose model `AivatarWallet`: one prepaid AIvatar-usage wallet per organisation, with balance and debt in cents.

**Kind:** Mongoose model · **Lines:** 28

## Purpose
Holds an organisation's prepaid credit for AIvatar (AI avatar) usage. Usage that exceeds the balance is tracked as `debt`, which can later be cleared. Every change is mirrored as a row in `AivatarWalletTransaction`.

## How it works
- `orgId` - required, unique: exactly one wallet per org (no `ref` declared).
- `balance` - integer cents, default 0, `min: 0`.
- `debt` - integer cents, default 0, `min: 0`.
- `lastTransactionAt` - optional.
- Timestamps on. Explicit collection name **`garage_aivatar_wallets`**.

## Exports
- `AivatarWallet` - Mongoose model.
- `interface IAivatarWallet` - `_id`, `orgId`, `balance`, `debt`, `lastTransactionAt?`, timestamps.

## Interfaces
- **Database:** `AivatarWallet` (collection `garage_aivatar_wallets`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/aivatarWallet.service.ts` - wallet operations.
- `server/routes/garageAdminWallets.ts` - admin console, mounted at `/garage-admin/wallets` (browser `/backend/garage-admin/wallets`).
- `server/scripts/backfill-shorupan-wallet-to-garage-hq.ts` - one-off backfill script (runs against `MONGODB_URI`, the production database).

## Notes
- Units are **cents** here, unlike `AffiliateWallet` / `AuctionWallet`, which use float USD.
