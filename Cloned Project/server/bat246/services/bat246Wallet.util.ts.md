# `server/bat246/services/bat246Wallet.util.ts`

> Shared store-wallet money movements for BAT246: the AT BAT payouts to Home Plate and 3rd Base (with the POD 70/10/10/10 split), the single wallet-credit function that every earning passes through (and which handles Snap Back Loan repayment), and the debit used for membership fees, which may take a wallet below zero.

**Kind:** BAT246 game module (backend) — service · **Lines:** 406

## Purpose
BAT246 pays players through their Garage store wallet in the BAT246 org. That org is resolved from the `organizationId` of the product tagged `bat246_entry`. Payouts are funded by debiting Alan K's (the admin's) wallet.

The helpers live in their own file to avoid circular imports between the entry, leaderboard and other services, and they load models with lazy `require()`. `directCreditStoreWallet` is deliberately the one place where earnings land, so cross-cutting rules such as Snap Back Loan repayment only had to be added here.

## How it works

### POD split recipients (L11-L74)
`buildPodSplitRecipients(mainUserId, total, podTeamId?)` is private.
- **No `podTeamId`:** 100% goes to the occupant.
- **With `podTeamId`:**
  - It finds the board that owns `podTeamId`. That board must have exactly 3 seated `pod[]` players; otherwise it falls back to paying the occupant solo.
  - The occupant gets 70% and each seat-holder with a linked `userId` gets 10%.
  - A seat-holder with no linked account loses their share; it is not given to anyone else.
  - If the occupant is also a seat-holder, their two shares are combined.
- Returns `{ recipients, isPodSplit }`.

### `transferAtBatPayment(homePlatePlayerId, podTeamId?)` (L76-L162)
This runs whenever a player lands on an AT BAT slot, and pays $200 (`AT_BAT_TRANSFER_AMOUNT`) to the board's Home Plate player.
1. Resolve the org, Alan's user and the Home Plate player's `userId`. If any is missing, return silently.
2. Build the recipient list.
3. Check that Alan's `StoreWallet` covers the total. If not, log a warning without the balance figure and skip.
4. Debit Alan with a `save()` plus a `WalletTransaction` debit, then credit each recipient through `directCreditStoreWallet`.

### `transferAtBatPaymentToThirdBase(playerId, greenCards, podTeamId?)` (L164-L273)
- **Amount:** $50 per Green Card (the slot's `salesCredits`, clamped to 0–2, so at most $100).
- **No Green Cards:** nothing is paid.
- **Flow and POD split:** the same steps and the same 70/10 split as the Home Plate payout. For example, with 2 cards the split is $70 / $10 / $10 / $10.
- Alan is debited only for what actually reaches real wallets.

### `directCreditStoreWallet(userId, orgId, amount, description, dedupeKey?)` (L275-L353)
This is the single function every real BAT246 earning goes through: AT BAT transfers, board sale revenue, leaderboard payouts, Lost Money auto-pay, and the membership fee credited to Alan.
1. **Loan repayment.** It first calls `applySnapBackLoanRepayment` (from `bat246SnapBackLoan.service.ts`).
2. **Diverted part.** If any amount was diverted, it writes a zero-balance-change `WalletTransaction` credit labelled "Snap Back Loan repayment (from: ...)" with `metadata.snapBackLoanRepayment: true`. It creates the wallet first if needed.
3. **Remainder.** It adds the rest to `StoreWallet.balance` and writes a `WalletTransaction` credit. When a `dedupeKey` is given, it is stored as `metadata.dedupeKey`.

### `directDebitStoreWalletAllowNegative(userId, orgId, amount, description, dedupeKey?)` (L355-L405)
- This is the only place where a store wallet is allowed to go negative.
- It uses `StoreWallet.updateOne` with `$inc: { balance: -amount }`. That bypasses Mongoose save validators, including the schema's `min: 0`.
- It writes a `WalletTransaction` debit, with an optional `dedupeKey`.
- It is used only for the $12 monthly membership fee.

## Exports
- `transferAtBatPayment(homePlatePlayerId, homePlatePodTeamId?): Promise<void>` — pays $200 to Home Plate. Every precondition failure (missing org, user or player; insufficient admin balance) returns silently without paying.
- `transferAtBatPaymentToThirdBase(thirdBasePlayerId, thirdBaseGreenCards, thirdBasePodTeamId?): Promise<void>` — pays $50 per Green Card to 3rd Base, with the same silent-return behaviour.
- `directCreditStoreWallet(userId, orgId, amount, description, dedupeKey?): Promise<void>` — the credit choke point; handles loan repayment.
- `directDebitStoreWalletAllowNegative(userId, orgId, amount, description, dedupeKey?): Promise<void>` — a debit with no balance check.

## Interfaces
- **Database:**
  - Reads and writes `StoreWallet` (model `StoreWallet`).
  - Creates `WalletTransaction` rows. The model has a unique partial index on `metadata.dedupeKey`.
  - Reads `User`, `Product`, `Bat246Player` and `Bat246Board`.
  - Writes loan records indirectly, through `applySnapBackLoanRepayment`.

## Dependencies
- **Internal:**
  - `server/bat246/models/bat246Board.model.ts` and `bat246Player.model.ts`.
  - `server/bat246/services/bat246SnapBackLoan.service.ts`.
  - `server/models/product.model.ts`, `storeWallet.model.ts`, `user.model.ts` and `walletTransaction.model.ts`.
- **Packages:** none directly.

## Used by
- `server/bat246/services/bat246.service.ts`, `bat246Admin.service.ts` and `bat246Entry.service.ts`, for the AT BAT transfers and credits.
- `bat246Leaderboard.service.ts`, for credits.
- `bat246LostMoneyAutoPay.service.ts`, for credits.
- `bat246MembershipBilling.service.ts`, for the credit and the allow-negative debit.

## Notes
- **Wallet updates are not atomic.** Debits and credits read the wallet, change the number in memory, and `save()`; they do not use atomic `$inc`. Concurrent payouts touching the same wallet, especially Alan's, could lose updates.
- **A duplicate dedupe key fails after the balance has changed.** The balance changes before the `WalletTransaction` insert. A duplicate `dedupeKey` therefore throws only after the money has moved, so the key protects the ledger rather than the balance. Callers rely on their own claims for idempotency.
- **Diverted earnings are recorded in two places.** The loan-repayment transaction row has `balanceBefore === balanceAfter`; the loan ledger, not the wallet, holds that money.
- The admin email is hardcoded on line 7.
