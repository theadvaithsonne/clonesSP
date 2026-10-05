# `server/models/founderSubBonusPayout.model.ts`

> Mongoose model for one recipient's payout line in a monthly founder Pro-subscription volume-bonus run, plus the wallet dedupe-key helper.

**Kind:** Mongoose model · **Lines:** 112

## Purpose
Each month the founder Pro-sub volume bonus pays direct referrers for the qualifying Pro-subscription sales they brought in. A `FounderSubBonusRun` is the run, and this model is one document per (run, recipient). It mirrors `WhitelabelBonusPayout`, and adds `tier` to record which side of the tiered payout fired. Per `services/founderSubMonthlyBonus/payout.ts`, the lower tier pays $24 per sale and the upper tier pays $48 per sale, with counted sales capped.

## How it works
- `FOUNDER_SUB_BONUS_PAYOUT_STATUSES` is `pending | paid | failed`, typed as `FounderSubBonusPayoutStatus`. `FounderSubBonusTier` is `lower | upper`.
- Fields (`IFounderSubBonusPayout`):
  - `runId` (ref `FounderSubBonusRun`, required, indexed).
  - `periodKey` (required, indexed, must match `YYYY-MM`) and `userId` (ref `User`, required, indexed).
  - `qualifyingSales` (all sales found), `tier`, `countedSales` (sales actually paid; the upper tier caps them; the comment says 100, and the real cap and thresholds come from config in `qualify.ts`), and `bonusUsd` (dollars, float).
  - `payoutStatus` (default `pending`, indexed), `routedToPlatform` (the money went to the platform instead of the user), `walletTransactionId`, `paidAt`, `attempts`, `lastError`.
  - `saleInvoiceIds[]` (audit trail) and `saleInvoiceIdsTruncated`. Callers cap the list at `MAX_PERSISTED_INVOICE_IDS` (200).
  - Timestamps are on.
- Idempotency is two-layered. A unique index on `{ periodKey, userId }` makes a re-run upsert instead of duplicate. On top of that, the wallet credit uses `founderSubMonthlyBonusDedupeKey`, so money moves at most once per period and recipient.
- An extra index on `{ runId, bonusUsd: -1 }` serves the admin "largest payouts in this run" listing.

## Exports
- `FOUNDER_SUB_BONUS_PAYOUT_STATUSES`, `FounderSubBonusPayoutStatus`, `FounderSubBonusTier`.
- `IFounderSubBonusPayout` - interface.
- `FounderSubBonusPayout` - the model (default collection `foundersubbonuspayouts`).
- `MAX_PERSISTED_INVOICE_IDS` - `200`.
- `founderSubMonthlyBonusDedupeKey(periodKey: string, userId: string): string` - returns `founder_sub_monthly_bonus_<periodKey>_<userId>`.

## Interfaces
- **Database:** `FounderSubBonusPayout` - upserted by qualify/run, updated by payout, read by admin routes.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/founderSubMonthlyBonus/qualify.ts`, `run.ts`, `payout.ts`.
- `server/routes/garageAdminFounderSubMonthlyBonus.ts` (mounted at `/garage-admin/founder-sub-monthly-bonus`, browser `/backend/garage-admin/founder-sub-monthly-bonus`) - the admin runs view and a cron trigger.

## Notes
- Changing the dedupe-key format would allow double payment for periods that were already paid.
