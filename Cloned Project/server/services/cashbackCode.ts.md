# `server/services/cashbackCode.ts`

> Cashback code service — orchestrates the affiliate-funded rebate flow.

**Kind:** backend service · **Lines:** 1964

<!-- docgen:auto -->

## Purpose
Cashback code service — orchestrates the affiliate-funded rebate flow.
Per the v2 product decision: each CashbackCode is bound to ONE specific
product (productType + itemId), carries a single ratePct, and optionally
restricts which of the creator's direct downline can use it via
`allowedBuyerIds`.

Phases:
  1. createCashbackCode / list / get / update / set status
     → creator-facing CRUD. Open to any user (the isEligibleCreator gate —
        formerly UP + ≥1 direct downline — was removed 2026-07-16).

  2. resolveEligibleItem(productType, itemId, orgId?)
     → look up the sellable item to (a) verify it exists at create-time
        and (b) derive its seller org for the storeWallet credit later.

  3. validateCouponOrCashback(code, ...) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `mapItemTypeToCashbackType` | function | `mapItemTypeToCashbackType(itemType: string): CashbackProductType \| null` | 53 |
| `ResolvedItem` | interface |  | 83 |
| `resolveEligibleItem` | function | `async resolveEligibleItem(productType: CashbackProductType, itemId: string): Promise<ResolvedItem \| null>` | 114 |
| `EligibilityCheck` | type |  | 245 |
| `isEligibleCreator` | function | `async isEligibleCreator(_userId: string, _email?: string): Promise<EligibilityCheck>` | 249 |
| `filterToDirectDownline` | function | `async filterToDirectDownline(creatorId: string, candidateIds: string[]): Promise<{ valid: string[]; invalid: string[] }>` — For each candidate userId, confirm it's the creator's direct downline. | 264 |
| `CashbackValidationInput` | interface |  | 286 |
| `CashbackValidationResult` | type |  | 298 |
| `validateCashbackCode` | function | `async validateCashbackCode(input: CashbackValidationInput): Promise<CashbackValidationResult>` | 307 |
| `CodeApplication` | type |  | 406 |
| `CouponOrCashbackInput` | interface |  | 415 |
| `validateCouponOrCashback` | function | `async validateCouponOrCashback(input: CouponOrCashbackInput): Promise<CodeApplication>` | 426 |
| `executeCashback` | function | `async executeCashback(invoice: any): Promise<void>` — Post-distribution cashback execution. | 482 |
| `EligibleCashbackMatch` | interface |  | 827 |
| `EligibleCashbackForItem` | interface |  | 855 |
| `GetEligibleCashbacksForBuyerInput` | interface |  | 866 |
| `getEligibleCashbacksForBuyer` | function | `async getEligibleCashbacksForBuyer(input: GetEligibleCashbacksForBuyerInput): Promise<{ items: EligibleCashbackForItem[]; uplin…` | 872 |
| `CreateCashbackCodeInput` | interface |  | 1132 |
| `createCashbackCode` | function | `async createCashbackCode(input: CreateCashbackCodeInput): Promise<ICashbackCode>` | 1149 |
| `UpdateCashbackCodeInput` | interface |  | 1218 |
| `updateCashbackCode` | function | `async updateCashbackCode(id: string, creatorId: string, input: UpdateCashbackCodeInput): Promise<ICashbackCode \| null>` | 1230 |
| `setCashbackCodeStatus` | function | `async setCashbackCodeStatus(id: string, creatorId: string, status: "active" \| "inactive"): Promise<ICashbackCode \| null>` | 1279 |
| `listCashbackCodesForCreator` | function | `async listCashbackCodesForCreator(params: { creatorId: string; status?: string; productType?:…): Promise<{ codes: ICashbackCode[]; total: number }>` | 1291 |
| `getCashbackCodeById` | function | `async getCashbackCodeById(id: string, creatorId: string): Promise<ICashbackCode \| null>` | 1317 |
| `getCashbackCodeDetail` | function | `async getCashbackCodeDetail(id: string, creatorId: string): Promise<(ICashbackCode & { itemName?: string; org…` — Detail view: the code enriched with the bound product's name and the owning org's name (both resolved on the fly). | 1333 |
| `listDistributionsForCode` | function | `async listDistributionsForCode(params: { codeId: string; creatorId: string; limit?: number…): Promise<{ distributions: any[]; total: number; to…` | 1368 |
| `getCashbackSummaryForCreator` | function | `async getCashbackSummaryForCreator(creatorId: string): Promise<{ totalPaidOutUsd: number; activeCodesCou…` — Aggregate summary across all codes for one creator — drives the summary strip on the creator's "Cashback Codes" wallet tab. | 1422 |
| `listDistributionsReceivedByUser` | function | `async listDistributionsReceivedByUser(params: { buyerId: string; limit?: number; skip?: number; }): Promise<{ distributions: any[]; total: number; to…` | 1445 |
| `AffiliateCashbackTeaser` | interface |  | 1479 |
| `getAffiliateCashbackForItem` | function | `async getAffiliateCashbackForItem(params: { affiliateId: string; productType: CashbackProduct…): Promise<AffiliateCashbackTeaser \| null>` | 1488 |
| `listEligibleItems` | function | `async listEligibleItems(params: { /** Optional office narrowing — NOT a membership …): Promise<ResolvedItem[]>` — The cashback product grid ("Cashbackable Offers"). | 1824 |
| `listEligibleBuyersForCreator` | function | `async listEligibleBuyersForCreator(creatorId: string): Promise< Array<{ _id: string; name?: string; emai…` — List the calling creator's direct downline so the create-form's optional "user whitelist" picker can populate. | 1944 |

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`, `findOne`
  - `CashbackCode` (server/models/cashbackCode.model.ts) — reads: `findOne`, `findById`, `find`, `countDocuments`, `aggregate`; **writes:** `updateOne`, `create`, `findOneAndUpdate`
  - `CashbackDistribution` (server/models/cashbackDistribution.model.ts) — reads: `countDocuments`, `exists`, `find`, `aggregate`; **writes:** `create`
  - `CommissionDistribution` (server/models/commissionDistribution.model.ts) — reads: `find`
  - `AffiliateWallet` (server/models/affiliateWallet.model.ts) — reads: `findOne`
  - `StoreWallet` (server/models/storeWallet.model.ts) — reads: `findOne`; **writes:** `create`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/cashbackCode.model.ts` — `CashbackCode`, `ICashbackCode`, `CashbackProductType`
  - `server/models/cashbackDistribution.model.ts` — `CashbackDistribution`
  - `server/models/commissionDistribution.model.ts` — `CommissionDistribution`
  - `server/models/affiliateWallet.model.ts` — `AffiliateWallet`
  - `server/models/storeWallet.model.ts` — `StoreWallet`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/services/platformCoupon.ts` — `validatePlatformCoupon`, `PlatformCouponValidationResult`
  - `server/services/catalogVisibility.ts` — `LEGACY_DIGITAL_PRODUCT_FILTER`, `orgIdsWithActiveStore`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/cashbackCodes.ts`
- `server/services/ecommerceInvoice.ts`
- `server/services/invoice.ts`

## Notes

- Large file (1964 lines) — read it by section; line numbers above point into it.
