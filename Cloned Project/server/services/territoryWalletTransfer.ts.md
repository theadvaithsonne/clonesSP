# `server/services/territoryWalletTransfer.ts`

> Module exporting `transferTerritoryToStoreWallet`.

**Kind:** backend service · **Lines:** 175

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `transferTerritoryToStoreWallet` | function | `async transferTerritoryToStoreWallet(params: { userId: string; orgId: string; amountCents: numbe…): Promise<{ territoryWallet: any; storeWallet: any;…` | 25 |

## Interfaces

- **Database (Mongoose models used):**
  - `TerritoryWallet` (server/models/territoryWallet.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `TerritoryWalletTransaction` (server/models/territoryWalletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/territoryWallet.model.ts` — `TerritoryWallet`
  - `server/models/territoryWalletTransaction.model.ts` — `TerritoryWalletTransaction`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
- **Packages:**
  - `mongoose` — `ClientSession`, `Types`

## Used by

- `server/routes/territoryWallet.ts`
