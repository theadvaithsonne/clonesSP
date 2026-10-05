# `server/services/commission.ts`

> Module exporting `resolvePlatformFeePercentage`, `createCombPlan`, `getCombPlan`, `getCombPlanForItem` and 11 more.

**Kind:** backend service · **Lines:** 2159

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PLATFORM_FEE_PERCENTAGE` | const | `= 5` | 22 |
| `PLATFORM_USER_EMAIL` | const | `= "shorupan@gmail.com"` | 31 |
| `PLATFORM_ORG_ID` | const | `= "68f1fe05876fcc5fadb61951"` | 32 |
| `PLATFORM_FEE_NO_PAID_PLAN` | const | `= 10` | 43 |
| `resolvePlatformFeePercentage` | function | `async resolvePlatformFeePercentage(orgId: string, orgDoc?: any): Promise<{ pct: number; reason: string }>` — The platform fee an org pays on a sale, derived from its effective plan. | 66 |
| `createCombPlan` | function | `async createCombPlan(data: { name: string; description?: string; itemType: "cour…): Promise<ICombPlan>` | 147 |
| `getCombPlan` | function | `async getCombPlan(planId: string): Promise<ICombPlan \| null>` | 204 |
| `getCombPlanForItem` | function | `async getCombPlanForItem(itemType: "course" \| "product" \| "channel" \| "workshop" \| "…, itemId: string): Promise<ICombPlan \| null>` | 208 |
| `resolveCombPlanForSale` | function | `async resolveCombPlanForSale(itemType: "course" \| "product" \| "channel" \| "workshop" \| "…, itemId: string, variantId?: string): Promise<ICombPlan \| null>` — Resolve the comb plan that governs a sale, honouring per-variant overrides. | 228 |
| `getCombPlansByOrg` | function | `async getCombPlansByOrg(orgId: string, options: { itemType?: "course" \| "product" \| "channel" \| "w…): Promise<{ plans: ICombPlan[]; total: number }>` | 240 |
| `updateCombPlan` | function | `async updateCombPlan(planId: string, updates: { name?: string; description?: string; levels?: IC…): Promise<ICombPlan \| null>` | 267 |
| `deleteCombPlan` | function | `async deleteCombPlan(planId: string): Promise<boolean>` | 301 |
| `getReferralChain` | function | `async getReferralChain(userId: string, maxLevel: number): Promise<{ userId: string; level: number }[]>` — Exported for the HiFi bond commission splitter, which needs the same upline walk but distributes a pre-computed POOL rather than a sale amount (see services/bondCommission.ts). | 333 |
| `QualifiedChainResult` | interface |  | 386 |
| `DistributeCommissionsInput` | interface |  | 468 |
| `DistributeCommissionsResult` | interface |  | 486 |
| `applyDropCreatorSplit` | function | `applyDropCreatorSplit(commissions: ICommissionRecipient[], totalCommission: number, dropCreatorId: string, splitPct: number = 25): boolean` — Drop-creator carve-out (pure, DB-free — unit-testable). | 510 |
| `distributeCommissions` | function | `async distributeCommissions(input: DistributeCommissionsInput): Promise<DistributeCommissionsResult>` — Distribute commissions for a sale | 560 |
| `getCommissionHistory` | function | `async getCommissionHistory(userId: string, options: { role?: "seller" \| "referrer"; orgId?: string; it…): Promise<{ distributions: ICommissionDistribution[…` | 1431 |
| `getItemCommissionStats` | function | `async getItemCommissionStats(itemType: "course" \| "product" \| "channel" \| "workshop" \| "…, itemId: string): Promise<{ totalSales: number; totalRevenue: numbe…` | 1533 |
| `reconcileThirdPartyCommissions` | function | `async reconcileThirdPartyCommissions(options?: { limit?: number; minAgeMinutes?: number; }): Promise<{ scanned: number; repaired: number; stil…` — Replay commission distribution for paid third-party invoices that never completed it. | 1600 |
| `distributeThirdPartySubscription` | function | `async distributeThirdPartySubscription(input: { invoice: any; // IInvoice paymentId: string; clien…): Promise<{ upDistributionId: string \| null; upDist…` — Distribute a third-party subscription payment. | 1690 |

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findById`
  - `CombPlan` (server/models/combPlan.model.ts) — reads: `findById`, `findOne`, `find`, `countDocuments`; **writes:** `updateMany`, `new + save`, `updateOne`, `deleteOne`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `exists`, `findOne`, `countDocuments`, `find`, `aggregate`; **writes:** `updateOne`, `create`
  - `User` (server/models/user.model.ts) — reads: `findById`, `findOne`
  - `Store` (server/models/store.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`; **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/combPlan.model.ts` — `CombPlan`, `ICombPlan`, `ICombPlanLevel`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`, `ICommissionDistribution`, `ICommissionRecipient`
  - `server/models/user.model.ts` — `User`
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/store.model.ts` — `Store`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/services/wallet.ts` — `creditAffiliateOrPlatform`
  - `server/services/territoryCommission.ts` — `distributeTerritoryCommissions`
  - `server/services/franchiseProgramCommission.ts` — `distributeFranchiseProgramCommissions`
  - `server/utils/exchangeRate.ts` — `convertToUsd`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/call.ts`
- `server/routes/callCheckout.ts`
- `server/routes/comb-plan.ts`
- `server/routes/course.ts`
- `server/routes/courseCheckout.ts`
- `server/routes/feed.ts`
- `server/routes/franchiseGlobal.ts`
- `server/routes/franchiseProgram.ts`
- `server/routes/garageAdminReferralBonus.ts`
- `server/routes/invoice.ts`
- `server/routes/product.ts`
- `server/routes/productCheckout.ts`
- `server/routes/service.ts`
- `server/routes/workshop.ts`
- `server/routes/workshopCheckout.ts`
- `server/scripts/audit-whitelabel-state.ts`
- `server/scripts/diagnoseAuctionSettlement.ts`
- `server/scripts/reconcile-franchise-floor-credits.ts`
- `server/scripts/retro-migrate-cascade-to-up.ts`
- `server/scripts/retro-platform-revenue.ts`
- `server/scripts/retro-pool-delta.ts`
- `server/scripts/revert-whitelabel-invoice.ts`
- `server/scripts/setup-test-account.ts`
- `server/scripts/smoke-test-franchise-global.ts`
- `server/scripts/verify-drop-commission-split.ts`
- _…and 22 more_

## Notes

- Large file (2159 lines) — read it by section; line numbers above point into it.
