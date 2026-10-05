# `lib/admin-api/withdrawals.ts`

> Garage-admin client for member wallet withdrawals: the withdrawal queue and stats, pricing a withdrawal before committing (fees, taxes, locks, super-admin overrides), starting, completing and rejecting withdrawals, and the read-only list of standing withdrawal preferences.

**Kind:** frontend library · **Lines:** 288

## Purpose
Members cannot withdraw by themselves. A super admin starts each payout from a member's `store`, `affiliate` or `content_rewards` wallet to a saved bank or crypto account. The payment is then sent outside the platform and marked complete (with a receipt) or rejected. This module types that workflow for the Withdrawals page, the initiate dialog, the Withdrawal Preferences tab, and the admin layout. All amounts are **integer cents** unless named otherwise.

## How it works
### The withdrawal record (L3-L82)
`AdminWithdrawal` holds:
- the member, the wallet (`walletType`, `walletLabel`, org), and the payout account snapshot;
- the money breakdown:
  - `grossAmount`, `feeAmount` / `feePercent`;
  - `bankTransferFee` - the bank's charge, taken out of the payout and **never** counted as platform revenue;
  - `taxes[]` and `taxTotal`, and `netAmount`;
  - `platformRetains` - fee plus taxes, which is what the platform actually keeps, excluding the bank's cut;
- `feeTier` (affiliate wallets only): the member's daily or weekly choice, whether they keep $50 in the wallet, and the payout method. It is recorded when the withdrawal starts, so a later preference change never alters what was charged;
- `adminOverride`: present only when a super admin overrode the fee or released locked funds. It records the tier fee, the applied fee, the caps, the released or locked amounts, the reason and the time;
- `status` (`initiated | completed | rejected`), `receiptUrl`, `rejectionReason`, timestamps.

`WithdrawalStats` gives the pending count and amount, plus completed and rejected counts.

### Pricing and overrides (L112-L179)
`quoteWithdrawal(body)` prices a withdrawal **without committing it**. It takes the user, wallet, optional account, `amountCents`, optional taxes, `bankTransferFeeCents` and `overrides`. The returned `WithdrawalQuote` includes:
- gross, fee, bank fee, taxes, net and platform-retained amounts;
- the fee tier, available balance, the keep amount and threshold, the amount payable after the keep, and whether the balance is `sufficient`;
- the payout method;
- optionally a `breakdown`, `ceilingCents`, `feeOverridden`, `tierFeePercent` and `releasingLockedFunds`.

`WithdrawableBreakdown` explains why the cap is what it is: balance, withdrawable, matured and redeemable amounts, plus two locks, **`lockedByMaturityCents`** and **`lockedByLicenceCents`**, with `maturityCutoff` and `hasLicence`. The two locks overlap, so their sum is **not** the total held back. Show them as separate reasons, never add them.

`WithdrawalOverrides` (`feePercent?`, `releaseLockedFunds?`, `reason?`) is for super admins and applies to one withdrawal only. It is never saved to the member's preference.

### Lifecycle calls (L94-L219)
- `listWithdrawals({ status?, search?, skip?, limit? })` and `getWithdrawalStats()`.
- `initiateWithdrawal(body)` - the same input as the quote, with `accountId` required. It creates the withdrawal.
- `completeWithdrawal(id, receiptUrl?)` and `rejectWithdrawal(id, reason?)`.
All of these unwrap the `{ success, data }` envelope.

### Withdrawal preferences (L221-L287)
Members can set standing payout instructions on their wallets. `listWithdrawalPreferences({ frequency?: "weekly" | "daily" | "all", due?, search?, skip?, limit? })` returns them with what is due against each one right now. `due: true` is sent as `due=1`.
- Each `WithdrawalPreferenceRow` has: the member, wallet type and org, `frequency`, `keepAmountCents` (applies to both daily and weekly), `withdrawableCents`, `dueCents` (withdrawable minus keep, never below 0), the processing fee for affiliate wallets (`feePercent`, `feeOnDueCents`, `netOnDueCents`), `feeTier`, `keepThresholdCents`, `nextRunAt`.
- `stats` has totals, the weekly/daily split, the count and amount due now, the fee across everything due, and `nextFriday` (the weekly payout day).
The list is read-only: staff still start the actual withdrawals from the queue.

## Exports
- Types: `WithdrawalStatus`, `AdminWithdrawal`, `WithdrawalsResult`, `WithdrawalStats`, `WithdrawalQuote`, `WithdrawableBreakdown`, `WithdrawalOverrides`, `WithdrawalFrequency`, `WithdrawalPreferenceRow`, `WithdrawalPreferencesResult`.
- `listWithdrawals(filters?)`, `getWithdrawalStats()` - the queue and its stats.
- `quoteWithdrawal(body)` - price a withdrawal without committing.
- `initiateWithdrawal(body)`, `completeWithdrawal(id, receiptUrl?)`, `rejectWithdrawal(id, reason?)` - the lifecycle.
- `listWithdrawalPreferences(filters?)` - standing preferences.

## Interfaces
- **Backend endpoints called** (every one requires `requireGarageAdminAuth` and `requireGarageSuperAdmin`):
  - In `server/routes/garageAdmin.ts`, mounted at `/garage-admin`:
    - `GET /backend/garage-admin/withdrawals` - the queue
    - `GET /backend/garage-admin/withdrawals/stats` - stats
    - `POST /backend/garage-admin/withdrawals/quote` - price a withdrawal
    - `POST /backend/garage-admin/withdrawals` - start a withdrawal
    - `POST /backend/garage-admin/withdrawals/:id/complete` - body `{ receiptUrl }`
    - `POST /backend/garage-admin/withdrawals/:id/reject` - body `{ reason }`
  - In `server/routes/garageAdminWithdrawalPreferences.ts`, mounted at `/garage-admin`:
    - `GET /backend/garage-admin/withdrawal-preferences?frequency&due&search&skip&limit` - standing preferences

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/layout.tsx`
- `app/garage-admin/(admin-dashboard)/withdrawals/page.tsx`
- `components/admin/InitiateWithdrawalDialog.tsx`
- `components/garage-admin/WithdrawalPreferencesTab.tsx`

## Notes
- `initiateWithdrawal` debits a real wallet balance. Quote first, and show the breakdown and any override reason before confirming.
