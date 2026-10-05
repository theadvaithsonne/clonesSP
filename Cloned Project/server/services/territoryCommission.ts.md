# `server/services/territoryCommission.ts`

> Module exporting `distributeTerritoryCommissions`.

**Kind:** backend service · **Lines:** 628

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DistributeTerritoryInput` | interface |  | 65 |
| `DistributeTerritoryResult` | interface |  | 88 |
| `distributeTerritoryCommissions` | function | `async distributeTerritoryCommissions(input: DistributeTerritoryInput): Promise<DistributeTerritoryResult>` — Entry point. Opens its own Mongo transaction. | 441 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseGlobalAssignment` (server/models/franchiseGlobalAssignment.model.ts) — reads: `findOne`
  - `User` (server/models/user.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `TerritoryWallet` (server/models/territoryWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `TerritoryWalletTransaction` (server/models/territoryWalletTransaction.model.ts) — **writes:** `create`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/territoryWallet.model.ts` — `TerritoryWallet`
  - `server/models/territoryWalletTransaction.model.ts` — `TerritoryWalletTransaction`
  - `server/models/franchiseGlobalAssignment.model.ts` — `FranchiseGlobalAssignment`
  - `server/utils/territoryResolver.ts` — `AddressInput`
  - `server/utils/franchiseGeoResolver.ts` — `resolveGeoChainFromAddress`
  - `server/services/franchiseChainPlan.ts` — `buildFranchiseChainPlan`
- **Packages:**
  - `mongoose` — `Types`, `ClientSession`

## Used by

- `server/services/commission.ts`
