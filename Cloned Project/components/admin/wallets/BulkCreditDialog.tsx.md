# `components/admin/wallets/BulkCreditDialog.tsx`

> Garage-admin dialog that credits the same USD amount to the AIvatar wallet of every organisation matching a filter, behind a typed "BULK CREDIT" confirmation.

**Kind:** React component · **Lines:** 217

## Purpose
Super admins sometimes need to hand out credits to many organisations at once (launch comps, cohort promotions, debt relief). This dialog is the UI for that action on the admin wallets overview page. It collects a filter and an amount, makes the admin confirm explicitly, calls the backend bulk-credit endpoint once and shows a success/failure summary.

## How it works
The dialog is a small four-stage state machine held in `stage` (`"filter" | "confirm" | "running" | "done"`):

1. **filter** - inputs for an optional "Org created before" date (`createdBefore`), an "Only orgs with outstanding debt" checkbox (`hasDebt`), the amount per org in USD (`amountStr`) and an optional note. The amount is converted to integer cents (`Math.round(parseFloat(...) * 100)`); **Continue** is enabled only when `0 < amountCents <= 100_000` (i.e. at most $1,000), mirroring the server cap.
2. **confirm** - shows a warning with the per-org amount and requires the admin to type exactly `BULK CREDIT` before **Run** is enabled. **Back** returns to the filter stage with inputs kept.
3. **running** - spinner while `runBulk()` awaits `bulkCredit({ amountCents, note, filter: { createdBefore, hasDebt } })`. Empty values are sent as `undefined` so they are dropped from the filter.
4. **done** - two tiles for `succeeded` and `failed` counts, and, if anything failed, up to 20 `orgId: error` lines from `result.errors`.

On success it calls the parent's `onComplete()` (the page uses it to reset its list pagination so the table reloads). On error it shows a `sonner` toast with the server message and returns to the filter stage. Closing the dialog (via `onOpenChange` or the Close button) calls `reset()`, which clears every field and returns to the filter stage.

The trigger button ("Bulk credit", `Layers` icon) is rendered inside the component via `DialogTrigger`, so the parent only places the component.

## Exports
- `BulkCreditDialog({ onComplete }: { onComplete: () => void })` - self-contained trigger button plus dialog; `onComplete` runs after a successful bulk run.

## Interfaces
- **Backend endpoints called:** `POST /backend/garage-admin/wallets/bulk-credit` (via `bulkCredit` in `lib/admin-api/wallets.ts`) - body `{ amountCents, note?, filter: { createdBefore?, hasDebt? } }`; response `{ succeeded, failed, errors[], orgIds[] }`. The router (`server/routes/garageAdminWallets.ts`) requires garage-admin auth plus the `garage-super-admin` role, re-validates the amount (positive integer up to `MAX_ADMIN_ACTION_CENTS = 100_000`), selects `Organization` documents created on or before the date, optionally narrows them to those whose `AivatarWallet` has `debt > 0`, then calls `addAivatarCredits` once per org, recording `source: "admin"` and the admin's email.
- **Database (indirect, via the backend):** `AivatarWallet` (collection `garage_aivatar_wallets`) and `AivatarWalletTransaction` (collection `garage_aivatar_wallet_transactions`) - written once per matched org.
- **Browser storage:** the admin bearer token `garage_admin_token` is read from localStorage by `garageAdminApi`.

## Dependencies
- **Internal:** `lib/admin-api/wallets.ts` - `bulkCredit` API call; `components/ui/dialog.tsx`, `button.tsx`, `input.tsx`, `label.tsx`, `textarea.tsx` - shadcn UI primitives.
- **Packages:** `react` (`useState`), `lucide-react` (icons), `sonner` (error toast).

## Used by
- `app/garage-admin/(admin-dashboard)/wallets/page.tsx` - the admin wallets list page (`/garage-admin/wallets` in the admin app; on the admin domain `middleware.ts` rewrites hosts onto `/garage-admin`).

## Notes
- **No idempotency key.** Unlike the single-org actions in `WalletActionDialogs.tsx`, this call sends no `Idempotency-Key`, and the backend loop does not pass one either. A retried or double-submitted request credits every matching org again. The typed confirmation and the disabled Run button while `stage === "running"` are the only guards.
- The confirm text says "Server caps at $1,000 per org"; that cap is per action, so total spend is amount times match count, which is not shown before running.
- The API client also accepts `filter.country` (and the server honours it), but this dialog has no country input.
- The backend credits orgs one by one in a single request; with many orgs the request can be slow, and a partially completed run is reported through `failed`/`errors` only if the request itself completes.
