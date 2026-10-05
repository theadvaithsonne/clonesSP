# `components/admin/PayoutAccountDetail.tsx`

> Admin panel that shows every populated field of one payout account (bank or crypto wallet), unmasked, with per-field copy buttons.

**Kind:** React component · **Lines:** 138

## Purpose
Before an admin sends money, they need to see and verify the full destination details: account numbers, IBAN, SWIFT, wallet addresses. This component renders those details in a consistent card grid. Per its header comment it is shared by the garage-admin user detail view (inside an expandable account row) and by `InitiateWithdrawalDialog`, where it is always visible under the selected payout account.

## How it works
- Takes an `AdminWalletAccount` (type from `lib/admin-api/users.ts`).
- `isBank = account.accountType === "bank"`.
- Builds a field list:
  - **Bank:** Bank name, Label, Beneficiary, Country, Account number, IBAN, SWIFT / BIC, Routing number. The four identifiers are monospace and copyable.
  - **Crypto:** Label, Network (mapped through `NETWORK_LABELS`: ethereum, tron, bitcoin, solana, bsc -> "BNB Chain", polygon; unknown networks show the raw value), Wallet address, Memo / tag. Address and memo are monospace and copyable.
- Drops empty fields. If none remain it returns `null`.
- Renders a 1-column (2 on `sm`+) grid of `DetailField` cards.
- For crypto accounts with an address, appends a warning that on-chain transactions are irreversible.

Internal helpers:
- `CopyButton({ value })` - writes the value to `navigator.clipboard`, shows a check icon for 1.4 s. Renders nothing for an empty value.
- `DetailField({ label, value, mono, copy })` - one labelled card.

## Exports
- `PayoutAccountDetail({ account, className })` - `account: AdminWalletAccount`, optional wrapper `className`.

## Dependencies
- **Internal:** `lib/admin-api/users.ts` - `AdminWalletAccount` type only.
- **Packages:** `react` (`useState`), `lucide-react` (Copy, Check, Globe icons).

## Used by
- `components/admin/InitiateWithdrawalDialog.tsx` (the import graph lists only this importer; the header comment also mentions the User Accounts detail row).

## Notes
- Security-sensitive by design: it displays full, unmasked bank account numbers and wallet addresses. It must only be rendered on super-admin surfaces.
- `NETWORK_LABELS` is duplicated in `InitiateWithdrawalDialog.tsx`.
