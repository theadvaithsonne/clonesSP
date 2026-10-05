# `components/admin/wallets/WalletActionDialogs.tsx`

> One reusable garage-admin dialog that credits, debits or clears the debt of a single organisation's AIvatar wallet, with an idempotency key per opening.

**Kind:** React component · **Lines:** 178

## Purpose
On the per-organisation wallet page a super admin can add credits, remove credits or write off debt. Rather than three separate dialogs, this file renders one dialog whose wording, validation and API call depend on a `mode` prop. The parent controls which mode is open and refreshes the wallet when an action succeeds.

## How it works
- **Open/close:** the dialog is open whenever `mode` is non-null; it renders nothing for `null`. Closing is blocked while a request is in flight (`onOpenChange` ignores closes when `submitting`).
- **Reset per opening:** a `useEffect` on `mode` clears the amount and note and generates a fresh idempotency key with `newIdempotencyKey()` (`crypto.randomUUID()` or a timestamp/random fallback). Retrying inside one opening reuses the same key, so a double-click or network retry does not apply the action twice; reopening produces a new key.
- **Mode metadata:** `MODE_META` maps each mode to a title and icon colours: `credit` "Add credits" (yellow), `debit` "Deduct credits" (red), `clear-debt` "Clear debt" (orange).
- **Validation:**
  - Amount (credit and debit only) is parsed into integer cents and must be `> 0` and `<= 100_000` ($1,000), matching the server cap.
  - For debit the amount must also be `<= currentBalance`, so the UI never asks for more than the wallet holds.
  - A note is required for debit and clear-debt (it goes to the audit log); optional for credit.
  - Clear-debt has no amount field; it clears the whole `currentDebt`.
- **Preview:** under the amount field it shows "New balance", computed locally (`currentBalance +/- amountCents`, floored at 0 for display).
- **Submit:** `submit()` calls `creditOrgWallet`, `debitOrgWallet` or `clearOrgDebt` with the key, shows a success toast naming the org and amount, then calls `onSuccess()` and `onClose()`. Errors surface as an error toast with the server message and leave the dialog open.

## Exports
- `WalletActionDialog(props: Props)` - the dialog. Props:
  - `mode: "credit" | "debit" | "clear-debt" | null` - which action to show; `null` hides it.
  - `onClose: () => void` - called on cancel or after success.
  - `onSuccess: () => void` - called after the API call succeeds (parent reloads data).
  - `orgId: string`, `orgName: string` - target organisation.
  - `currentBalance: number`, `currentDebt: number` - in cents; used for validation, preview and messages.

## Interfaces
- **Backend endpoints called** (via `lib/admin-api/wallets.ts`, each with an `Idempotency-Key` header and the admin bearer token):
  - `POST /backend/garage-admin/wallets/:orgId/credit` - body `{ amountCents, note? }`; server calls `addAivatarCredits` with `source: "admin"`.
  - `POST /backend/garage-admin/wallets/:orgId/debit` - body `{ amountCents, note }`; server rejects with 422 "Insufficient balance" if `balance < amount`, then calls `deductAivatarCreditsWithDebt`.
  - `POST /backend/garage-admin/wallets/:orgId/clear-debt` - body `{ note }`; server calls `clearAivatarDebt`.
  All three live in `server/routes/garageAdminWallets.ts` behind `requireGarageAdminAuth` and `requireGarageSuperAdmin`, and validate `orgId` and the amount cap again.
- **Database (indirect):** `AivatarWallet` (`garage_aivatar_wallets`) and `AivatarWalletTransaction` (`garage_aivatar_wallet_transactions`), written by the backend services.
- **Browser storage:** `garage_admin_token` in localStorage, read by `garageAdminApi`.

## Dependencies
- **Internal:** `lib/admin-api/wallets.ts` - `creditOrgWallet`, `debitOrgWallet`, `clearOrgDebt`; `components/ui/dialog.tsx`, `button.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx` - UI primitives.
- **Packages:** `react` (`useState`, `useEffect`), `lucide-react` (icons), `sonner` (toasts).

## Used by
- `app/garage-admin/(admin-dashboard)/wallets/[orgId]/page.tsx` - the per-org admin wallet detail page.

## Notes
- The file name is plural but it exports a single component.
- The confirm button's class includes `disabled:hover:bg-[#FBD10D]`, so a disabled red (debit/clear-debt) button turns yellow on hover; cosmetic only.
- The clear-debt success toast reports the `currentDebt` passed in by the parent, not the amount the server actually cleared.
