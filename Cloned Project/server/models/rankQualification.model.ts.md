# `server/models/rankQualification.model.ts`

> Mongoose model with one row per qualifying user per month in the NetworkChain rank bonus: the audit record of why they qualified and the payout work queue.

**Kind:** Mongoose model · **Lines:** 117

## Purpose
After a monthly `RankRun` computes ranks, each qualifying user gets a `RankQualification` row. It answers support questions ("why did this person get $240 in August?") without re-running the computation, and the payout loop walks these rows to credit wallets. Money safety is layered: `(periodKey, userId)` is unique here, and the wallet credit itself is guarded by a `metadata.dedupeKey` on the `WalletTransaction`, so a crash between writing this row and crediting the wallet is recoverable from either side.

## How it works
- **Basis (`BasisSchema`, no `_id`):** `selfActive` (the user's own subscription was active at snapshot time - always true for a qualifier), `activeDirects` (direct referrals with an active paid subscription), `legsWithRank` (Mixed map such as `{ Bronze: 5, Silver: 2 }` - distinct legs containing a holder of each rank or better), `totalDirects` (all direct referrals, active or not).
- **Row fields:** `runId` (ref `RankRun`, indexed), `periodKey` (`"YYYY-MM"`), `userId` (ref `User`, indexed), `rank` (one of `RANK_KEYS`, indexed), `bonusUsd` (total owed including stacked Bronze - Silver is 240, not 200), `basis`, `payoutStatus` (`pending` default | `paid` | `skipped_dry_run` | `failed`, indexed), `routedToPlatform` (true when the earner holds no active UP licence, so the money went to the platform), `walletTransactionId` (ref `WalletTransaction`; absent means no money moved), `paidAt`, `attempts` (default 0), `lastError`, timestamps.
- **Indexes:** unique `{ periodKey, userId }` (a re-run upserts onto the existing row) and `{ runId, payoutStatus }` (the payout loop's work query).
- **`rankBonusDedupeKey(periodKey, userId)`** returns `rankbonus_<periodKey>_<userId>`. This key goes on the wallet credit so any replay (retry, re-run, concurrent replica) is rejected by the partial unique index in `walletTransaction.model.ts` rather than by application logic.

## Exports
- `RankQualification` - model `"RankQualification"` (collection `rankqualifications`).
- `RANK_PAYOUT_STATUSES` - `["pending", "paid", "skipped_dry_run", "failed"]`.
- `RankPayoutStatus` - union type of those statuses.
- `IRankBasis`, `IRankQualification` - interfaces.
- `rankBonusDedupeKey(periodKey: string, userId: string): string` - wallet idempotency key.

## Interfaces
- **Database:** `RankQualification` (collection `rankqualifications`) - schema only; written by the rank bonus run/payout services.

## Dependencies
- **Internal:** `server/models/rankPlan.model.ts` - `RANK_KEYS` for the `rank` enum.
- **Packages:** `mongoose` - schema and model.

## Used by
`server/services/rankBonus/run.ts`, `server/services/rankBonus/payout.ts`, `server/services/rankBonus/detail.ts`, `server/routes/rankBonus.ts` (`/backend/rank-bonus`), `server/routes/garageAdminRankBonus.ts` (`/backend/garage-admin/rank-bonus`).

## Notes
- Amounts are dollars (floats), matching the wallet layer.
- `skipped_dry_run` is used when the run executed with `RANK_BONUS_PAYOUTS_ENABLED` off, so rows are computed but no money moves.
