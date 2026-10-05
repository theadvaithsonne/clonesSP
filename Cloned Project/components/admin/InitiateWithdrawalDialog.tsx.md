# `components/admin/InitiateWithdrawalDialog.tsx`

> Super-admin dialog for starting a payout from a user's wallet to one of their saved bank or crypto accounts, with live server-side fee quotes, taxes, a bank fee and one-off overrides.

**Kind:** React component · **Lines:** 643

## Purpose
Members earn money into wallets (affiliate, store, content rewards). Withdrawals are initiated by the Garage team from the admin "User Wallets" page. This dialog collects the destination account, the amount and any deductions, shows a breakdown priced by the server, and commits through `POST /backend/garage-admin/withdrawals`. Its guiding rule, stated in the code: **the fee is never computed client-side**. Every money figure comes from `POST /backend/garage-admin/withdrawals/quote`, because the affiliate fee depends on the member's payout preference (daily or weekly, and whether they keep a $50 buffer).

## How it works

### Props and derived values (L50-L129)
- Props: `userId`, `wallet: AdminUserWallet`, `walletLabel`, `open`, `onOpenChange`, `onDone`.
- State: `accountId` (defaults to the first account), `amount`, `taxes` (rows of `{ id, label, type: "percent" | "flat", value }`), `bankFee`, `quote`, `quoting`, `submitting`, plus super-admin overrides `releaseLocked`, `feeOverride` and `overrideReason`.
- All money is handled in cents. `grossCents` comes from the amount box; `bankFeeCents` applies only to bank accounts; tax rows are computed locally for display (percent of gross, or flat dollars).
- `feeOverridePct`: an empty box means "use the member's tier", not 0%; a value is clamped to 0-100.
- `overrides` is sent only when something is overridden: `{ releaseLockedFunds?, feePercent?, reason? }`.
- `available = quote.ceilingCents ?? wallet.withdrawableBalance`. The comment warns never to fall back to `wallet.balance`, because on this row `withdrawableBalance` is in cents and `balance` is in dollars.
- `valid` requires an account, at least 1 cent, not over `available`, a net of at least 1 cent, and every tax row labelled with a non-negative value (percent at most 100).

### Live quote (L131-L176)
Debounced by 300 ms on any change to account, amount, bank fee, taxes, wallet, `releaseLocked` or the fee override. It calls `quoteWithdrawal` with `amountCents: max(1, grossCents)`, so the wallet breakdown can render before an amount is typed. Percent taxes are sent as the percentage; flat taxes as cents. An `alive` flag drops stale responses. A failed quote sets `quote` to `null`.

### UI sections (scrollable body, L237-L620)
1. **Balance breakdown** - shown only when `breakdown.balanceCents !== withdrawableCents`. It lists the wallet balance, what is withdrawable now, and the reasons for the gap, listed separately and never summed because they overlap:
   - `lockedByMaturityCents`: credited since last Sunday, matures at the next Sunday 11:59pm IST.
   - `lockedByLicenceCents`: earned before a Unilevel Plus licence was bought.

   A checkbox, "Release locked funds for this withdrawal", raises the cap to the real balance.
2. **Payout preference** (affiliate wallets only) - frequency, amount kept in the wallet, whether it meets `keepThresholdCents`, and the resulting tier fee. Members with nothing saved get the default (fallback text shows 5%).
3. **Payout account picker** - a button per account with a masked label (bank `••••1234`, crypto `0xabcd…1234`), plus a "Verify destination" card that renders `PayoutAccountDetail` with the full unmasked details.
4. **Amount** - USD input and a "Max" button that fills `available`.
5. **Live breakdown** (once the amount is valid) - gross; Garage processing fee with an inline % override box (its placeholder is the tier %); a bank transfer fee input for bank accounts ("charged by the bank - not kept by Garage"); up to 10 editable tax / deduction rows with a %/$ toggle; Net payout; and "Garage keeps (fee + taxes)" from `quote.platformRetainsCents`.
6. **Override warning** - appears when released funds exceed the rules (`releasedCents > 0`) or `quote.feeOverridden`. It explains the exception, warns when the release reaches licence-locked commissions, and takes a reason (max 500 chars) that is stored on the withdrawal record.

### Submit (L182-L219)
`initiateWithdrawal({ userId, walletType, orgId?, accountId, amountCents, bankTransferFeeCents, taxes, overrides? })`. `orgId` is sent only when the wallet has one: store and content-rewards wallets are per-org, the affiliate wallet is not. On success it toasts, closes, resets the form and calls `onDone()`.

### Helpers
- `newTaxRow()` - new row with a module-level incrementing id.
- `fmt(cents)` - `$x,xxx.xx`.
- `accountLabel(account)` - masked one-line label.

## Exports
- `InitiateWithdrawalDialog(props)` - the dialog.

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/garage-admin/withdrawals/quote` - authoritative fee, net, ceiling, breakdown and fee tier.
  - `POST /backend/garage-admin/withdrawals` - creates the withdrawal (status `initiated`).
  Both go through `garageAdminApi` (admin token from `localStorage` `garage_admin_token`) and are served by `server/routes/garageAdmin.ts`.

## Dependencies
- **Internal:** `components/admin/PayoutAccountDetail.tsx` - full destination details for verification.
- **Internal:** `components/ui/button.tsx`, `components/ui/dialog.tsx`, `components/ui/input.tsx` - UI primitives.
- **Internal:** `lib/admin-api/withdrawals.ts` - `initiateWithdrawal`, `quoteWithdrawal`, `WithdrawalQuote`.
- **Internal:** `lib/admin-api/users.ts` - `AdminUserWallet`, `AdminWalletAccount` types.
- **Packages:** `react`, `lucide-react`, `sonner`.

## Used by
- `app/garage-admin/(admin-dashboard)/user-wallets/page.tsx` (admin route `/garage-admin/user-wallets`).

## Notes
- The overrides apply to this withdrawal only; per the UI copy, the member's saved preference and fee tier are not changed. The wallet is still debited the full gross amount, and the fee only splits that gross.
- The local `netCents` fallback (gross minus bank fee minus taxes, with no fee) is used only before the first quote arrives. The server's numbers are what get committed.
- `NETWORK_LABELS` is duplicated from `PayoutAccountDetail.tsx`.
