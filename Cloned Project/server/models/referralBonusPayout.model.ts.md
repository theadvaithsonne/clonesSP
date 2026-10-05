# `server/models/referralBonusPayout.model.ts`

> Mongoose model recording each paid signup referral bonus; its unique `refereeUserId` index is the idempotency guarantee against paying the same signup twice.

**Kind:** Mongoose model · **Lines:** 82

## Purpose
The signup referral bonus (configured by `ReferralBonusConfig`) is triggered when a user completes their profile, which they can do repeatedly by editing it. Without a guard every edit would pay another pair of bonuses from the platform wallet. One `ReferralBonusPayout` row per referred user, enforced by a unique index, prevents that. The row is also the audit trail: the amount is snapshotted per payout, so later config changes never rewrite what someone was paid.

## How it works
- `refereeUserId` (ref `User`, required, **unique**) - the new user who signed up.
- `referrerUserId` (ref `User`, required, indexed) - who referred them.
- `amountUsd` - snapshot of the configured amount, paid to each side; `totalDebitedUsd` - `amountUsd x 2`, debited from the platform store wallet.
- `refereeOrgId`, `referrerOrgId` (ref `Organization`).
- `refereeTransactionId`, `referrerTransactionId`, `platformTransactionId` - the wallet transactions created for the credit/debit legs.
- `referrerEmailedAt`, `refereeEmailedAt` - when each notification email actually went out. Null means the money moved but the email did not; a send failure must never roll back money, so this makes that state visible.
- `reversedAt`, `reversedReason` - set when the payout is clawed back. Currently that happens only when the referred account is merged into a pre-existing one (`server/services/accountMerge.ts`), which would otherwise let one person earn a referrer a bonus per throwaway signup.
- Schema options: `timestamps: true`, explicit `collection: "referralbonuspayouts"`; extra index `{ createdAt: -1 }` for newest-first listings.
- Registered with a `mongoose.models.ReferralBonusPayout ||` guard against duplicate model registration.

## Exports
- `ReferralBonusPayout` - the model (collection `referralbonuspayouts`).
- `IReferralBonusPayout` - document interface.

## Interfaces
- **Database:** `ReferralBonusPayout` (collection `referralbonuspayouts`) - written by the payout service, updated on reversal, listed by admins.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/services/referralSignupBonus.ts` - creates rows when paying the bonus.
- `server/services/accountMerge.ts` - looks up and reverses the payout when an account is merged.
- `server/routes/garageAdminReferralBonus.ts` - `GET /payouts` under `/garage-admin/referral-bonus` (browser: `/backend/garage-admin/referral-bonus/payouts`), super-admin only.

## Notes
- Do not drop or relax the unique index on `refereeUserId`; it is what prevents double payment, not a convenience.
