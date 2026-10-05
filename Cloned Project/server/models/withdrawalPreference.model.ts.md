# `server/models/withdrawalPreference.model.ts`

> Mongoose model storing a member's standing payout instruction per wallet: how often to be paid (weekly or daily) and how much to leave in the wallet.

**Kind:** Mongoose model · **Lines:** 60

## Purpose
Withdrawals in Garage are always initiated by an admin (see `withdrawal.model.ts`). This model does not move any money; it is an instruction the back-office reads. The admin "Preferences" sub-tab under Vaults -> Withdrawals lists these rows to see who is due (every Friday for weekly, every day for daily) and how much (withdrawable balance minus the keep-amount). The header dates the spec to 19 Sep 2026. For the affiliate wallet, the frequency/keep choice also feeds the withdrawal fee tier (`server/config/affiliateWithdrawalFees.ts`).

## How it works
- One document per `(userId, walletType, orgId)`, enforced by a unique compound index. A missing document means the default: weekly, keep nothing.
- `walletType` reuses `WITHDRAWAL_WALLET_TYPES` from `withdrawal.model.ts` (`store`, `affiliate`, `content_rewards`).
- `orgId` is set for store wallets (which are per organisation); `null` otherwise.
- `frequency` is `weekly` or `daily`, default `weekly`, indexed for the admin filter.
- `keepAmountCents` - cents to leave behind on each payout; `null` (default) means withdraw the whole withdrawable balance. The interface comment says it only matters for weekly, though `routes/wallet.ts` deliberately keeps it on daily too because the fee grid reads it.
- `timestamps: true`.

## Exports
- `WithdrawalPreference` - the Mongoose model.
- `WITHDRAWAL_FREQUENCIES` - `["weekly", "daily"]`.
- `WithdrawalFrequency` - union type of the above.
- `DEFAULT_WITHDRAWAL_FREQUENCY` - `"weekly"`.
- `IWithdrawalPreference` - document interface.

## Interfaces
- **Database:** `WithdrawalPreference` (collection `withdrawalpreferences`) - defines the schema; references `User` and `Organization`.

## Dependencies
- **Internal:** `server/models/withdrawal.model.ts` - `WITHDRAWAL_WALLET_TYPES` and `WithdrawalWalletType`.
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/routes/wallet.ts` - member endpoints `GET /backend/wallet/withdrawal-preference`, `PUT /backend/wallet/withdrawal-preference` (upsert) and `GET /backend/wallet/withdrawal-fees` (reads the affiliate preference to quote the fee).
- `server/routes/garageAdminWithdrawalPreferences.ts` - `GET /backend/garage-admin/withdrawal-preferences` (super admin) lists preferences.
- `server/config/affiliateWithdrawalFees.ts` - uses the `WithdrawalFrequency` type for its fee matrix.
- `server/services/withdrawal.ts` - reads the preference when resolving the affiliate fee at quote/initiate time.

## Notes
- The interface comment says `orgId` is null for content_rewards, but `services/withdrawal.ts` now treats content_rewards as a per-org wallet; check which `orgId` callers actually write for that wallet type before relying on either.
