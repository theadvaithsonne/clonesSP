# `server/services/jobRewards.ts`

> src/services/jobRewards.ts

**Kind:** backend service · **Lines:** 439

<!-- docgen:auto -->

## Purpose
src/services/jobRewards.ts

Referral rewards for Garage Jobs, built entirely on the EXISTING money flows:

  • GaragePay store wallet  — debitStoreWallet / creditStoreWallet (USD)
  • Unilevel Plus tree      — distributeUnilevelPlusCommission, called exactly
                              the way founder comb plans call it in
                              services/commission.ts (buyer = the customer,
                              sweepUnspent "return", source
                              "comb_plan_unilevel_plus")

Nothing in wallet.ts or unilevelPlusCommission.ts is modified. The only new
state is the posting's `reward.heldAmount` and the JobReward ledger.

Flow
  publish (funding "hold")   debit amount × openings from the payer, keep it […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `InsufficientFundsError` | class | `extends Error` | 39 |
| `RewardSplitPreview` | interface |  | 47 |
| `rewardSplitPreview` | function | `async rewardSplitPreview(amount: number): Promise<RewardSplitPreview \| null>` — How a reward of `amount` splits under the live Unilevel Plus plan. | 57 |
| `holdAmountFor` | function | `holdAmountFor(job: Pick<IJobPosting, "reward" \| "openings">): number` — Amount a posting reserves at publish: reward × openings. | 81 |
| `holdJobRewards` | function | `async holdJobRewards(job: IJobPosting, payerId: string): Promise<number>` — Reserve the posting's rewards from the payer's GaragePay wallet. | 91 |
| `releaseJobHold` | function | `async releaseJobHold(jobId: string \| Types.ObjectId, reason: string): Promise<number>` — Give back whatever is still held for a posting (closed, filled, deleted). | 128 |
| `createRewardForHire` | function | `async createRewardForHire(job: IJobPosting, app: IJobApplication, joiningDate: Date, actorId: string): Promise<IJobReward \| null>` — Open the reward ledger entry for a referred hire. | 165 |
| `rescheduleReward` | function | `async rescheduleReward(applicationId: Types.ObjectId, joiningDate: Date): Promise<void>` — Joining date moved before payout — the guarantee moves with it. | 213 |
| `cancelRewardLeftEarly` | function | `async cancelRewardLeftEarly(rewardId: string, reason: string): Promise<IJobReward \| null>` — The hire left early. Before payout the reward is cancelled and a held reward goes back to the payer; after payout it is flagged for the manual refund the terms describe. | 226 |
| `payoutReward` | function | `async payoutReward(rewardId: string, now = new Date()): Promise<IJobReward \| null>` — Pay one reward whose guarantee has ended. | 276 |
| `sweepJobRewards` | function | `async sweepJobRewards(now = new Date()): Promise<number>` — Sweeper entry point: pay every reward whose guarantee has ended. | 392 |
| `paidRewardSplit` | function | `async paidRewardSplit(distributionId?: string)` | 411 |

## Interfaces

- **Database (Mongoose models used):**
  - `JobPosting` (server/models/jobPosting.model.ts) — reads: `findById`; **writes:** `updateOne`, `findOneAndUpdate`
  - `JobReward` (server/models/jobReward.model.ts) — reads: `findOne`, `findById`, `find`; **writes:** `create`, `findOneAndUpdate`, `updateOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `findOne`
  - `UnilevelPlusDistribution` (server/models/unilevelPlusDistribution.model.ts) — reads: `findById`

## Dependencies

- **Internal:**
  - `server/models/jobPosting.model.ts` — `JobPosting`, `IJobPosting`
  - `server/models/jobApplication.model.ts` — `IJobApplication`
  - `server/models/jobReward.model.ts` — `JobReward`, `IJobReward`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/unilevelPlusDistribution.model.ts` — `UnilevelPlusDistribution`
  - `server/services/wallet.ts` — `debitStoreWallet`, `creditStoreWallet`, `getStoreWalletBalance`
  - `server/services/unilevelPlusCommission.ts` — `getActiveUnilevelPlusPlan`, `distributeUnilevelPlusCommission`
- **Packages:**
  - `mongoose` — `Types`

## Used by

- `server/routes/jobsCandidate.ts`
- `server/routes/jobsFounder.ts`
- `server/services/jobsSweeper.ts`
