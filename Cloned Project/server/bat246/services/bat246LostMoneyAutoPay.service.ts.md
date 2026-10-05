# `server/bat246/services/bat246LostMoneyAutoPay.service.ts`

> Moves 3% of every real BAT246 sale from the admin (Alan K) store wallet to the people at the front of the "Lost Money Paid List", paying them in rounds of up to $300.

**Kind:** BAT246 game module (backend) — service · **Lines:** 182

## Purpose
The BAT246 game keeps a "Lost Money" repayment queue: people with an approved claim (`Bat246LostMoneyPaid` rows) are repaid over time. This file automates that repayment. Each time a real $650 Board Entry or $160 POD Entry sale happens, 3% of the amount actually paid is debited from Alan K's Garage store wallet and credited to whoever is first in line. It lives in its own file, not in `bat246Wallet.util.ts` or `bat246Entry.service.ts`, to avoid circular imports. That is also why every model is loaded with a lazy `require()` inside the function.

## How it works
`runLostMoneyAutoPay(saleAmount)` works in two passes. The whole body sits in a `try/catch` that only logs, so it never throws.

1. **Guards.** It returns immediately if `saleAmount` is not a positive finite number. Admin manual placements pass 0, so they never trigger it. It also returns if `Bat246LostMoneyPaymentSettings.paymentsEnabled === false` (payments paused), if the 3% cut rounds to 0, if no product tagged `bat246_entry` exists (that product's `organizationId` is the BAT246 org used for wallets), or if the admin user cannot be found by the hardcoded `ALAN_K_EMAIL`.
2. **Pass 1: plan the payout in memory, with no writes.** It walks the queue sorted by `order` ascending, up to 25 iterations. It only picks rows that are not `fullyRepaid`, have a linked `userId` (rows added by name only are never auto-paid), and are not parked in the 90-day waiting period. The waiting-period filter matches rows where `movedToLineupAt` does not exist or is non-null, the same "active lineup" filter used by the Lost Money admin grid.
   - If `approvedAmount - totalPaid <= 0`, the row is stale. The function writes `fullyRepaid: true` straight away and skips it. This is the only write in pass 1, and no money is involved.
   - Round target = `min(300, remaining approved)`. Free space = target − `roundAccumulated`.
   - The function applies `min(remaining cut, space)`. A row marked `finalize` is one whose round this payment completes. Each person is used at most once per sale. Any leftover cut that nobody can absorb is simply not paid and stays with Alan.
3. **Balance check.** Alan's `StoreWallet` for that org must hold at least the planned total. If it doesn't, the function logs a warning (without the balance figure) and does nothing.
4. **Pass 2: commit.** It debits Alan once with a direct `save()` and writes one `WalletTransaction` debit ("Bat246 Lost Money auto-pay (3% of sale)"). It then credits each recipient through `directCreditStoreWallet`. That helper may divert the money to an outstanding Snap Back Loan; see `bat246Wallet.util.ts`.
   - **Partial round.** Only `roundAccumulated` grows. The public `totalPaid` does not change, so payments in progress stay hidden.
   - **Finalized round.** `totalPaid += roundTarget`, `lastPaymentAmount` and `lastPaymentAt` are set, `roundAccumulated` resets to 0, and `fullyRepaid` is set once `totalPaid >= approvedAmount`. The person moves to the end of the line (`order = max(order) + 1`). A `Bat246LostMoneyPayment` row is created with `source: "auto"` and `recordedByEmail: "system"`.

Helper `round2()` rounds to cents throughout.

## Exports
- `runLostMoneyAutoPay(saleAmount: number): Promise<void>` — runs the 3% drip for one sale. Never throws.

## Interfaces
- **Database:**
  - Reads `Bat246LostMoneyPaymentSettings`, `Product` (tag `bat246_entry`) and `User`.
  - Reads and writes `Bat246LostMoneyPaid` (model `bat246LostMoneyPaid`) and `StoreWallet`.
  - Creates `WalletTransaction` and `Bat246LostMoneyPayment` rows.
- **Background work:** none of its own. Callers fire and forget it with `.catch()`.

## Dependencies
- **Internal:** `server/bat246/models/bat246LostMoneyPaid.model.ts`, `bat246LostMoneyPayment.model.ts` and `bat246LostMoneyPaymentSettings.model.ts` (the queue, its payment ledger and the pause switch); `server/bat246/services/bat246Wallet.util.ts` (`directCreditStoreWallet`); `server/models/product.model.ts`, `storeWallet.model.ts`, `user.model.ts` and `walletTransaction.model.ts`.
- **Packages:** none directly. Models are Mongoose.

## Used by
- `server/bat246/services/bat246Entry.service.ts`, for $650 Board Entry sales.
- `server/bat246/services/bat246PodInvite.service.ts`, through `markPodPurchaseCompleted`, for $160 POD purchases.

It is not reachable by HTTP directly.

## Notes
- Real money moves here. Alan's debit is a read-modify-`save()`, not an atomic `$inc`. Two concurrent sales could therefore read the same balance, and one debit could be lost.
- The admin email is hardcoded as a constant on line 30, the same pattern as the other BAT246 files.
- `bat246Layaway.service.ts` says that sales paid with B2 Coins pay less into this drip; that logic lives in the caller, not here.
