# `server/models/territoryWallet.model.ts`

> Mongoose model for the per-user aggregate wallet that holds franchise (territory) commission earnings.

**Kind:** Mongoose model · **Lines:** 53

## Purpose
Territory owners in the franchise programme (country, territory and sub-territory owners) earn a slice of platform fees. Rather than one wallet per owned entity, each user has exactly one `TerritoryWallet` into which earnings from every entity they own roll up. Per-entity attribution lives on `TerritoryWalletTransaction` rows, not here. The header comment explains the deliberate separation from `StoreWallet` and `AffiliateWallet`: territory owners are franchise-app users, cash-out is owned by that project, and mixing balances would muddy the audit trail.

## How it works
Schema fields (with `timestamps: true`):

| Field | Type | Notes |
| --- | --- | --- |
| `userId` | ObjectId -> `User` | required, **unique**, indexed: one wallet per user |
| `balance` | Number | required, default 0, `min: 0` |
| `currency` | String | default `"USD"` |
| `isActive` | Boolean | default true |
| `totalEarnings` | Number | lifetime credits, default 0, `min: 0` |
| `totalWithdrawn` | Number | lifetime debits/transfers out, default 0, `min: 0` |
| `lastTransactionAt` | Date | touched on every balance change |

No hooks, methods or extra indexes are defined. Balance mutation logic lives in services: `services/territoryCommission.ts` and `services/franchiseProgramCommission.ts` credit it (the latter loads the wallet inside a Mongo session), and `services/territoryWalletTransfer.ts` (`transferTerritoryToStoreWallet`) debits it inside a transaction, rejecting inactive wallets, non-USD wallets and insufficient balances before moving the money to the user's per-org `StoreWallet`.

## Exports
- `TerritoryWallet` - Mongoose model `"TerritoryWallet"` (default collection `territorywallets`).

## Interfaces
- **Database:** `TerritoryWallet` (collection `territorywallets`) - defines the schema; read/written by the importers below.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
`server/routes/territoryWallet.ts` (mounted at `/territory-wallet`, browser `/backend/territory-wallet`: self-serve balance read and transfer to store wallet), `server/routes/franchise.ts` (`/franchise`, JWT-authed vault read), `server/routes/franchiseApi.ts` (`/franchise-api`, key-gated read API for the external franchise admin project), `server/services/franchiseProgramCommission.ts`, `server/services/territoryCommission.ts`, `server/services/territoryWalletTransfer.ts`, and the hand-run script `scripts/test-franchise-e2e.ts`.

## Notes
- `min: 0` on `balance` is a schema-level guard only; it is enforced on `save()`/validators, not on raw `$inc` updates, so services must check balance themselves (the transfer service does).
- Currency is effectively USD-only; the transfer service throws if a wallet ever carries another currency.
