# `server/models/unilevelPlusDistribution.model.ts`

> Mongoose model recording how one Unilevel Plus (UP) sale's commission was split across the company, the direct referrer, level-bonus recipients and the reserved infinity / manager pools.

**Kind:** Mongoose model · **Lines:** 347

## Purpose
Unilevel Plus is the platform's MLM-style compensation plan. Each qualifying sale (licence purchases, third-party subscriptions, founder comb plans and others) is run through `distributeUnilevelPlusCommission` in `server/services/unilevelPlusCommission.ts`, which writes exactly one `UnilevelPlusDistribution` document per payment. The document is the audit record of the split: plan figures, what each recipient was actually credited, what was forfeited and where it went, and the wallet transactions that carried the money. Genealogy, affiliate transaction detail and job-reward services read it to show earnings.

## How it works

### Level-bonus recipients (`UPLevelBonusRecipientSchema`, L97-L150, `_id: false`)
`userId` (-> `User`), `level` (>=1), `legNumber` (>=1), `legMultiplier` (>=1), `points` (>=0), `amount` (the **plan** allocation), `directChildId` (-> `User`, the recipient's direct child on the path to the buyer), `walletId` (-> `AffiliateWallet`), `transactionId` (-> `WalletTransaction`), plus the coverage-split fields below.

### Infinity-bonus recipients (`UPInfinityBonusRecipientSchema`, L152-L190, `_id: false`)
`userId`, `tier` (1 or 2), `amount` (plan figure), `directReferralCount` (>=0), `walletId`, `transactionId`, plus the coverage-split fields.

### Coverage-split fields (on both recipient types and on the direct bonus)
- `creditedAmount` - what actually reached the wallet.
- `forfeitedAmount` - the part forwarded away.
- `forfeitedToUserId` - who received it; absent means the platform did.
These differ from `amount` only when the NetworkChain coverage split fired (`server/services/networkChainCoverage.ts`): an earner without live coverage keeps half and the rest moves up the chain. They are absent on rows written before the split existed, so **readers must fall back to `amount`** when `creditedAmount` is missing. The direct bonus uses the parallel top-level fields `directBonusCreditedAmount`, `directBonusForfeitedAmount`, `directBonusForfeitedToUserId`.

### Distribution document (L192-L315)
- Sale: `planId` (-> `UnilevelPlusPlan`, required), `buyerId` (-> `User`, required), `saleAmount` (required), `currency` (default `USD`), `paymentId` (string, the idempotency key).
- Breakdown: `companyAmount`, `directBonusAmount`, `directBonusRecipientId`, `levelBonusBudget`, `levelBonusDistributed`, `levelBonusRecipients[]`.
- Reserved pools: `infinityTier1Amount` / `Recipients` / `Distributed`, `infinityTier2Amount` / `Recipients` / `Distributed`, `managerBonusAmount`, `unallocatedAmount`.
- Lifecycle: `status` (`pending | completed | failed | reversed`, default `pending`, indexed), `failureReason`, `metadata` (Mixed; for example `metadata.source === "comb_plan_unilevel_plus"` marks a founder comb plan in the service).
- Timestamps on.

### Indexes (L317-L341)
Per-earner history queries are indexed: `{buyerId, createdAt}`, `{directBonusRecipientId, createdAt}`, `{"levelBonusRecipients.userId", createdAt}`, `{"infinityTier1Recipients.userId", createdAt}`, `{"infinityTier2Recipients.userId", createdAt}`, plus `{planId, status}`. A **unique sparse index on `paymentId`** prevents two distributions for the same payment; the service also checks `findOne({ paymentId })` first and returns the existing row (re-deriving its unspent figure) on a replay.

## Exports
- `UnilevelPlusDistribution` - Mongoose model `"UnilevelPlusDistribution"` (collection `unilevelplusdistributions`).
- `interface IUPLevelBonusRecipient`, `interface IUPInfinityBonusRecipient`, `interface IUnilevelPlusDistribution`.

## Interfaces
- **Database:** `UnilevelPlusDistribution` (collection `unilevelplusdistributions`); references `UnilevelPlusPlan`, `User`, `AffiliateWallet`, `WalletTransaction`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/services/unilevelPlusCommission.ts` (writer), `server/routes/unilevel-plus.ts` (mounted at `/unilevel-plus`), `server/services/affiliateTransactionDetail.ts`, `server/services/genealogy/data.ts`, `server/services/jobRewards.ts`, `server/services/uplineCommissionMove.ts`, and hand-run scripts that read or rewrite production data: `server/scripts/audit-cryptobrand-bootstrap.ts`, `move-unilevel-commission.ts`, `reset-wallets.ts`, `retro-migrate-cascade-to-up.ts`, `retro-up-single-to-six-units.ts`, `verify-split-stats.ts`.

## Notes
- `paymentId` is declared with `index: true` and also gets a separate `{ paymentId: 1 }` unique sparse index. Both target the same key with different options; Mongoose may warn about a duplicate index and MongoDB can refuse to build the second one if the plain index already exists, which would leave the uniqueness guard missing. Check the live indexes if idempotency matters.
- Multi-month third-party terms run several UP distributions per purchase (see `thirdPartyClient.model.ts`), so callers must pass a distinct `paymentId` per month or later months will be treated as replays.
