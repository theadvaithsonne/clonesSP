# `server/models/jobReward.model.ts`

> Mongoose model for the referral reward owed for one hire in Garage Jobs, tracking it through the guarantee period to payout or cancellation.

**Kind:** Mongoose model · **Lines:** 96

## Purpose
When a founder confirms a hire whose application came in through a referral link, a `JobReward` row is created. It records who pays (`payerId`, whose GaragePay wallet funds it), who earns (`referrerId`), the amount and the guarantee window. Once the guarantee period ends, the reward is paid out through the existing Unilevel Plus distribution.

## How it works
### State machine (from the header comment)
```
in_guarantee -> processing -> paid
                           \-> payment_due   (payer's wallet could not cover an "on_hire" reward; retried later)
in_guarantee -> cancelled   (hire left early; reserved funds go back)
paid         -> refund_due  (hire left after payout; settled manually)
```
`failed` is also in the enum (the service sets it with `lastError` when a payout throws). `processing` is a **claim**: a sweeper atomically moves a row into it before touching money, so two sweepers, or a sweeper and a manual retry, can never pay the same reward twice.

### Fields
- Refs (all required): `orgId`, `jobId` (`JobPosting`), `applicationId` (`JobApplication`), `candidateId`, `payerId`, `referrerId` (`User`).
- `amount` (>= 0), `currency` (default `"USD"`; the interface types it as the literal `"USD"`).
- `funding`: `"hold"` (funds reserved at publish) or `"on_hire"` (charged when hired). Required.
- `status` (enum `REWARD_STATUSES`, default `in_guarantee`).
- `joinedAt`, `guaranteeDays`, `guaranteeEndsAt` - all required.
- Payout results: `paidAt`, `paidAmount` (what the network actually earned), `returnedAmount` (what went back to the payer), `distributionId`.
- Cancellation: `cancelledAt`, `cancelReason` (max 500).
- Retry bookkeeping: `lastError` (max 1000), `attempts` (default 0).
- Timestamps on.

### Indexes
- `{ applicationId: 1 }` **unique** - one reward per hire. `jobRewards.ts` catches the resulting duplicate-key error (code 11000) and returns the existing row.
- `{ orgId: 1, status: 1, createdAt: -1 }` - an org's payouts ledger.
- `{ status: 1, guaranteeEndsAt: 1 }` - the sweeper's "guarantee has ended" query.
- `{ referrerId: 1, createdAt: -1 }` - a referrer's earnings.

## Exports
- `JobReward` - Mongoose model `"JobReward"`.
- `IJobReward` - interface for the reward record.
- `REWARD_STATUSES`, `RewardStatus`.

## Interfaces
- **Database:** `JobReward` (collection `jobrewards`) - read/write.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/jobRewards.ts` - creates rewards on hire, cancels them, claims and pays due rewards.
- `server/routes/jobsFounder.ts` (`/jobs/founder`) - lists rewards / payouts for the founder.

## Notes
- Not to be confused with the `IJobReward` interface in `jobPosting.model.ts`, which describes a posting's reward settings.
- Money moves only after the atomic claim into `processing`; anything editing status by hand should respect that.
