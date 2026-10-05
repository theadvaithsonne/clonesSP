# `lib/admin-api/user-wallets.ts`

> Garage-admin client for the global "User Wallets" list: one row per user per wallet, filterable, sortable and paginated.

**Kind:** frontend library · **Lines:** 85

## Purpose
This module powers the admin "User Wallets" page. The page lists every user's wallets: one `store` row per organisation, plus one row each for the `affiliate` and `content_rewards` wallets. The list only has summary data. When the admin clicks Withdraw, the page loads full account details with `getUserWallets()` from `lib/admin-api/users.ts`.

## How it works
- `qs(params)` builds the query string:
  - skips `undefined`, `null` and `""`;
  - a boolean `true` is sent as `1` and `false` is left out (this is how `hasFunds` travels);
  - everything else is converted with `String()`.
- `listAllUserWallets(filters)` calls `GET /backend/garage-admin/user-wallets?...` through `garageAdminApi` and returns `data` from the response.
- `balance` is always USD as a float; per the source comment, the server converts `content_rewards` from cents first.
- `countries` and `payoutCounts` in the result are counted **before** the country and payout filters are applied, so the dropdown and the with/without-payout split stay stable while filters change.

## Exports
- `type UserWalletType` - `"store" | "affiliate" | "content_rewards"`.
- `interface UserWalletRow` - `walletId`, `walletType`, `user { _id, name?, email?, profilePicture?, country? }`, `orgId`/`orgName` (store wallets), `balance` (USD), `currency`, `lastTransactionAt`, `hasAccount` (whether a payout account is attached).
- `interface UserWalletsListResult` - `items`, `total`, `limit`, `offset`, optional `countries`, optional `payoutCounts { withAccount, withoutAccount }`.
- `interface UserWalletsListFilters` - `q`, `type` (a wallet type or `"all"`), `sort` (`balance`/`name`/`activity`), `hasFunds`, `country` (free text, matched ignoring case and whitespace), `payout` (`any`/`yes`/`no`), `limit`, `offset`.
- `interface UserWalletCountry` - `{ country, count }`, most populated first.
- `listAllUserWallets(filters?: UserWalletsListFilters): Promise<UserWalletsListResult>`

## Interfaces
- **Backend endpoints called:** `GET /backend/garage-admin/user-wallets` - served by `server/routes/garageAdmin.ts` behind `requireGarageAdminAuth` and `requireGarageSuperAdmin` (super admin only).

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`.

## Used by
- `app/garage-admin/(admin-dashboard)/user-wallets/page.tsx`
