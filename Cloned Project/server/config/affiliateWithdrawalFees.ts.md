# `server/config/affiliateWithdrawalFees.ts`

> Pricing rules for the Garage processing fee charged on affiliate-wallet withdrawals, based on payout frequency and how much the user leaves in the wallet.

**Kind:** backend config · **Lines:** 137

## Purpose
The affiliate withdrawal fee is an incentive, not a cost recovery: paying out less often and keeping a buffer in the wallet lowers the fee. This module is the single place that turns a user's saved withdrawal preference into a fee percentage and into the exact copy the product shows. Only the **affiliate** wallet is priced this way; store and content-rewards withdrawals are free (see `resolveWithdrawalFee` in `services/withdrawal.ts`).

## How it works
- **Fee matrix** (percent of gross, private `MATRIX`):

  | frequency | keeps less than $50 | keeps $50 or more |
  |-----------|---------------------|-------------------|
  | daily     | 5%                  | 2%                |
  | weekly    | 2%                  | 0%                |

- **Keep threshold:** `AFFILIATE_KEEP_THRESHOLD_CENTS = 5000` ($50). `keepAmountCents` at or above this earns the lower column.
- **Default for unconfigured users:** a user with no saved preference (or no `frequency`) pays `AFFILIATE_DEFAULT_FEE_PERCENT = 5`, i.e. the old flat fee, and the result has `configured: false`. The reasoning in the comments: the discounts are opt-in, and silently cutting the fee for every existing user would be an unrequested revenue change. The UI nudges users to configure.
- `resolveAffiliateFeeTier(pref)` clamps a negative keep amount to 0, falls back to the weekly row for an unknown frequency, and returns the resolved tier.
- **Payout method** does not change the Garage fee. A bank payout additionally carries the bank's own transfer fees, which are deducted from the payout and never credited to the platform; crypto has no such pass-through. The method only changes the label text: bank -> "`N`% Garage processing fee + bank transfer fees charged by the bank", crypto -> "`N`% Garage processing fee".
- `affiliateFeeMatrix()` builds all four cells (daily/weekly x keeps/doesn't keep), each with per-method entries (crypto, bank) carrying `feePercent`, `bankFeeApplies` and a ready-to-render `label`.

## Exports
- `AFFILIATE_KEEP_THRESHOLD_CENTS` - 5000 ($50).
- `AFFILIATE_DEFAULT_FEE_PERCENT` - 5.
- `type PayoutMethod` - `"bank" | "crypto"`.
- `interface AffiliateFeeTier` - `{ frequency, keepAmountCents, meetsKeepThreshold, feePercent, configured }`.
- `resolveAffiliateFeeTier(pref: { frequency?, keepAmountCents? } | null | undefined): AffiliateFeeTier` - fee for a user's saved preference.
- `interface FeeMatrixCell` - one grid cell with per-method labels.
- `affiliateFeeMatrix(): FeeMatrixCell[]` - the whole grid for the configuration screen.
- `describeAffiliateFee(tier, method): string` - one line of copy for a resolved tier and method.

## Interfaces
- **Endpoints that use it:** `GET /backend/wallet/withdrawal-fees?walletType=affiliate` (`routes/wallet.ts`) returns the matrix, threshold, default and the user's current tier; other wallet withdrawal routes attach a `feeTier`. The admin withdrawal-preferences routes (`routes/garageAdminWithdrawalPreferences.ts`, mounted under `/garage-admin`) show each user's resolved tier.

## Dependencies
- **Internal:** `server/models/withdrawalPreference.model.ts` - type-only import of `WithdrawalFrequency` (`"weekly" | "daily"`).

## Used by
- `server/routes/wallet.ts`
- `server/routes/garageAdminWithdrawalPreferences.ts`
- `server/services/withdrawal.ts` - applies the fee when a withdrawal is processed.
- `server/services/__tests__/affiliateWithdrawalFees.test.ts`

## Notes
- The model's default frequency is `"weekly"`, and an unconfigured tier also reports `frequency: "weekly"`, but it still charges 5%, not the weekly 2%. `configured` is the only way to tell these apart.
