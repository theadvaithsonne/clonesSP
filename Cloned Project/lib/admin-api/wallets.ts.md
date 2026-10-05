# `lib/admin-api/wallets.ts`

> Garage-admin client for organisation wallets: list, stats, per-org detail and transactions, credit/debit/clear-debt with idempotency keys, bulk credit, the cross-org ledger, and CSV export.

**Kind:** frontend library · **Lines:** 176

## Purpose
This module backs the admin Wallets pages (`/garage-admin/wallets`, `/garage-admin/wallets/[orgId]`, `/garage-admin/wallets/ledger`) and their dialogs. On the backend (`server/routes/garageAdminWallets.ts`) these are the per-organisation **Aivatar credit wallets** (`AivatarWallet`, `AivatarWalletTransaction`), and the wallet can carry a debt as well as a balance. Do not confuse them with the per-user store, affiliate and content-rewards wallets in `lib/admin-api/user-wallets.ts`.

## How it works
- `qs(params)` builds the query string. It skips empty values, and joins arrays with commas (as used by `types`, `sources` and `orgIds` in the ledger filters).
- **Reads.** All return the response body unchanged, with no `data` envelope.
  - `listWallets(filters)` - a page of `WalletListItem`. Filters: `sort` (`balance`, `debt`, `lastActivity`), `order`, `hasDebt`, `minDebt`, `search`, and `q` (header search across org name/slug and founder name/email).
  - `getWalletStats()` - total orgs, total balance, total debt, number of orgs with debt.
  - `getOrgWallet(orgId)` - the org, its wallet and recent transactions.
  - `getOrgWalletTransactions(orgId, { limit, skip })` - paged transactions.
  - `getLedger(filters)` - transactions across all orgs, filtered by date range, type (`credit`, `debit`, `clear_debt`), source (`user`, `admin`, `system`) and org ids. Each row has `orgName`, `orgSlug` and `orgDeleted`; the result adds `totalIn` / `totalOut`.
- **Writes** send an `Idempotency-Key` header supplied by the caller, so a retried or double-clicked action is applied only once:
  - `creditOrgWallet(orgId, { amountCents, note? }, key)`;
  - `debitOrgWallet(orgId, { amountCents, note }, key)`, where a note is required; per the route's service names, a debit beyond the balance becomes debt;
  - `clearOrgDebt(orgId, { note }, key)`.
  The backend caps a single admin action at `MAX_ADMIN_ACTION_CENTS` (100,000 cents = $1,000).
- **`bulkCredit({ amountCents, note?, filter: { createdBefore?, country?, hasDebt? } })`** credits every org that matches the filter. It returns `succeeded`, `failed`, per-org `errors` and the `orgIds` it touched. It sends no idempotency key.
- **`fetchLedgerCsv(filters)`** downloads `/garage-admin/wallets/ledger/export.csv` with a direct `fetch` and the admin Bearer token, because a plain `<a download>` link cannot send an auth header. It returns a blob URL (`URL.createObjectURL`). It throws if there is no admin token or the response is not OK. The caller should revoke the URL when done.

## Exports
- Types: `WalletListItem`, `WalletStats`, `WalletTransaction`, `PagedResult<T>`, `OrgWalletDetail`, `ListFilters`, `LedgerFilters`, `LedgerResult`.
- Reads: `listWallets(f?)`, `getWalletStats()`, `getOrgWallet(orgId)`, `getOrgWalletTransactions(orgId, opts?)`, `getLedger(f?)`.
- Writes: `creditOrgWallet(orgId, body, idempotencyKey)`, `debitOrgWallet(orgId, body, idempotencyKey)`, `clearOrgDebt(orgId, body, idempotencyKey)`, `bulkCredit(body)`.
- `fetchLedgerCsv(f?): Promise<string>` - blob URL of the CSV.

## Interfaces
- **Backend endpoints called** (`server/routes/garageAdminWallets.ts`, mounted at `/garage-admin/wallets`; the router requires `requireGarageAdminAuth` and `requireGarageSuperAdmin` on every request):
  - Reads:
    - `GET /backend/garage-admin/wallets` - wallet list
    - `GET /backend/garage-admin/wallets/stats` - totals
    - `GET /backend/garage-admin/wallets/ledger` - cross-org ledger
    - `GET /backend/garage-admin/wallets/ledger/export.csv` - CSV export
    - `GET /backend/garage-admin/wallets/:orgId` - one org's wallet
    - `GET /backend/garage-admin/wallets/:orgId/transactions` - one org's transactions
  - Writes:
    - `POST /backend/garage-admin/wallets/:orgId/credit` - credit
    - `POST /backend/garage-admin/wallets/:orgId/debit` - debit
    - `POST /backend/garage-admin/wallets/:orgId/clear-debt` - clear debt
    - `POST /backend/garage-admin/wallets/bulk-credit` - bulk credit
- **Database (indirect):** `AivatarWallet` and `AivatarWalletTransaction` on the backend.
- **Browser storage / cookies:** reads `localStorage.garage_admin_token` for the CSV export.
- **Environment variables:** `NEXT_PUBLIC_API_URL`, read through `API_URL`.

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`, `API_URL`.

## Used by
- `app/garage-admin/(admin-dashboard)/wallets/page.tsx`
- `app/garage-admin/(admin-dashboard)/wallets/[orgId]/page.tsx`
- `app/garage-admin/(admin-dashboard)/wallets/ledger/page.tsx`
- `components/admin/wallets/BulkCreditDialog.tsx`
- `components/admin/wallets/StatsCards.tsx`
- `components/admin/wallets/WalletActionDialogs.tsx`
