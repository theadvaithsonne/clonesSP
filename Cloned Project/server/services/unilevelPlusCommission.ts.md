# `server/services/unilevelPlusCommission.ts`

> Module exporting `initializeUnilevelPlusPlan`, `getActiveUnilevelPlusPlan`, `createUnilevelPlusPlan`, `getUnilevelPlusPlan` and 8 more.

**Kind:** backend service · **Lines:** 1495

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `initializeUnilevelPlusPlan` | function | `async initializeUnilevelPlusPlan(): Promise<IUnilevelPlusPlan>` — Initialize the global Unilevel Plus plan in the database. | 95 |
| `getActiveUnilevelPlusPlan` | function | `async getActiveUnilevelPlusPlan(): Promise<IUnilevelPlusPlan \| null>` — Get the single global active Unilevel Plus plan. | 165 |
| `createUnilevelPlusPlan` | function | `async createUnilevelPlusPlan(data: { name: string; description?: string; productPrice: n…): Promise<IUnilevelPlusPlan>` | 171 |
| `getUnilevelPlusPlan` | function | `async getUnilevelPlusPlan(planId: string): Promise<IUnilevelPlusPlan \| null>` | 217 |
| `getActivePlanForOrg` | function | `async getActivePlanForOrg(_orgId?: string): Promise<IUnilevelPlusPlan \| null>` | 224 |
| `getUnilevelPlusPlansByOrg` | function | `async getUnilevelPlusPlansByOrg(_orgId?: string, options: { isActive?: boolean; limit?: number; offset?: num…): Promise<{ plans: IUnilevelPlusPlan[]; total: numb…` | 230 |
| `updateUnilevelPlusPlan` | function | `async updateUnilevelPlusPlan(planId: string, updates: { name?: string; description?: string; productPric…): Promise<IUnilevelPlusPlan \| null>` | 251 |
| `deleteUnilevelPlusPlan` | function | `async deleteUnilevelPlusPlan(planId: string): Promise<boolean>` | 300 |
| `getUserPurchase` | function | `async getUserPurchase(userId: string): Promise<IUnilevelPlusPurchase \| null>` | 321 |
| `INFINITY_T1_MIN_LEGS` | const | `= 4` | 455 |
| `INFINITY_T2_MIN_LEGS` | const | `= 10` | 456 |
| `DistributeUPCommissionInput` | interface |  | 468 |
| `DistributeUPCommissionResult` | interface |  | 493 |
| `distributeUnilevelPlusCommission` | function | `async distributeUnilevelPlusCommission(input: DistributeUPCommissionInput): Promise<DistributeUPCommissionResult>` — Distribute commissions for a Unilevel Plus product purchase. | 521 |
| `getUPCommissionHistory` | function | `async getUPCommissionHistory(userId: string, options: { limit?: number; offset?: number; } = {}): Promise<{ distributions: IUnilevelPlusDistributio…` | 1212 |
| `getUPCommissionStats` | function | `async getUPCommissionStats(userId: string): Promise<{ totalDirectBonusEarned: number; totalLe…` | 1248 |

## Interfaces

- **Database (Mongoose models used):**
  - `UnilevelPlusPlan` (server/models/unilevelPlusPlan.model.ts) — reads: `findById`, `findOne`, `find`, `countDocuments`; **writes:** `updateMany`, `create`, `new + save`, `updateOne`, `deleteOne`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `exists`, `findOne`, `find`, `countDocuments`, `aggregate`; **writes:** `create`
  - `UnilevelPlusPurchase` (server/models/unilevelPlusPurchase.model.ts) — reads: `findOne`, `countDocuments`
  - `User` (server/models/user.model.ts) — reads: `find`, `countDocuments`, `findById`, `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/unilevelPlusPlan.model.ts` — `UnilevelPlusPlan`, `IUnilevelPlusPlan`, `UNILEVEL_PLUS_PLAN_CONFIG`, `UNILEVEL_PLUS_PLAN_ID`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`, `IUnilevelPlusDistribution`, `IUPLevelBonusRecipient`, `IUPInfinityBonusRecipient`
  - `server/models/unilevelPlusPurchase.model.ts` — `UnilevelPlusPurchase`, `IUnilevelPlusPurchase`
  - `server/models/user.model.ts` — `User`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `scripts/mint-synthetic-combo.ts`
- `server/bat246/routes/bat246.routes.ts`
- `server/index.ts`
- `server/routes/genealogy.ts`
- `server/routes/platformOffices.ts`
- `server/routes/publicFounderProduct.ts`
- `server/routes/publicFoundersOffice.ts`
- `server/routes/publicUnilevelPlus.ts`
- `server/routes/publicWhiteLabel.ts`
- `server/routes/unilevel-plus.ts`
- `server/routes/webhook.ts`
- `server/scripts/move-unilevel-commission.ts`
- `server/scripts/retro-migrate-cascade-to-up.ts`
- `server/scripts/retro-up-single-to-six-units.ts`
- `server/scripts/verify-split-stats.ts`
- `server/services/bondCommission.ts`
- `server/services/comboCheckout.ts`
- `server/services/commission.ts`
- `server/services/conversionFee.ts`
- `server/services/cryptosubAddonPurchase.ts`
- `server/services/invoice.ts`
- `server/services/jobRewards.ts`
- `server/services/officeEligibility.ts`
- `server/services/officeGrace.ts`
- `server/services/officeProInvoiceCommission.ts`
- _…and 5 more_
