# `server/services/franchiseProgramCommission.ts`

> Module exporting `distributeFranchiseProgramCommissions`.

**Kind:** backend service · **Lines:** 402

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DistributeFranchiseProgramInput` | interface |  | 45 |
| `DistributeFranchiseProgramResult` | interface |  | 62 |
| `distributeFranchiseProgramCommissions` | function | `async distributeFranchiseProgramCommissions(input: DistributeFranchiseProgramInput): Promise<DistributeFranchiseProgramResult>` | 91 |

## Interfaces

- **Database (Mongoose models used):**
  - `FranchiseProgram` (server/models/franchiseProgram.model.ts) — reads: `findOne`
  - `FranchiseTerritoryAssignment` (server/models/franchiseTerritoryAssignment.model.ts) — reads: `find`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`
  - `TerritoryWallet` (server/models/territoryWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `TerritoryWalletTransaction` (server/models/territoryWalletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/territoryWallet.model.ts` — `TerritoryWallet`
  - `server/models/territoryWalletTransaction.model.ts` — `TerritoryWalletTransaction`
  - `server/models/franchiseProgram.model.ts` — `FranchiseProgram`
  - `server/models/franchiseTerritoryAssignment.model.ts` — `FranchiseTerritoryAssignment`, `FranchiseGeoLevel`
  - `server/utils/franchiseGeoResolver.ts` — `resolveGeoChainFromAddress`
  - `server/utils/territoryResolver.ts` — `AddressInput`
  - `server/services/franchiseChainPlan.ts` — `buildFranchiseChainPlan`
- **Packages:**
  - `mongoose` — `Types`, `ClientSession`

## Used by

- `scripts/test-franchise-e2e.ts`
- `server/services/commission.ts`
