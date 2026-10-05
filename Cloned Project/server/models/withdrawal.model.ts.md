# `server/models/withdrawal.model.ts`

> Mongoose model for an admin-initiated wallet withdrawal: the single source of truth for a payout's amounts, fees, taxes, status and proof of payment.

**Kind:** Mongoose model · **Lines:** 218

## Purpose
Members earn money into three wallet kinds (store, affiliate, content rewards), but paying it out is done by the Garage back-office team, not by the member. This model records every such payout. The header comment explains why a dedicated collection exists: the native wallet ledgers (in particular the content-rewards wallet) have no per-transaction status, so the lifecycle (initiated, completed, rejected), the fee and the receipt live here instead.

All money fields are integers in **cents**, matching the campaign / content-rewards code.

## How it works
### Lifecycle (enforced by `server/services/withdrawal.ts`, not by the schema)
- **initiated** - a super admin creates the row (`initiatedByAdmin`); the wallet balance is debited immediately by the gross amount.
- **completed** - the admin marks it paid (`processedByAdmin`, `processedAt`, `receiptUrl` / `txHash` / `proofs`). The debit stays; per the header comment, the platform fee is credited to the platform (Shorupan) store wallet at this point (`feeTransactionRef` holds that reference).
- **rejected** - the admin rejects it with a `rejectionReason`; the debit is refunded to the wallet.

### Amount breakdown
`grossAmount` (min 1 cent, total debited) minus `feeAmount` (`round(gross * feePercent%)`, `feePercent` defaults to 5) minus `taxTotal` (sum of `taxes[].amount`) gives `netAmount`. `bankTransferFee` is the bank's own transfer charge: deducted from the payout like a tax but never credited to the platform, and always 0 for crypto. The arithmetic itself is done by the service; the schema only stores the results.

`taxes` is an array of admin-added deduction lines (`WithdrawalTaxSchema`, no `_id`): `label` (max 60 chars), `type` (`percent` or `flat`), `value` (a percent, or flat cents) and the computed `amount` in cents.

### Snapshots kept for history
- `accountSnapshot` (Mixed) - a copy of the destination bank/crypto account at initiate time, alongside the `accountId` reference to `WalletAccount` and `accountType` (`bank` | `crypto`).
- `feeTier` (affiliate wallet only) - why `feePercent` has the value it has: `frequency`, `keepAmountCents`, `meetsKeepThreshold`, `configured`, `payoutMethod`. Snapshotted so a later change to the member's `WithdrawalPreference` never rewrites history.
- `adminOverride` (optional sub-document) - present only when a super admin departed from the rules: charged a different fee (`tierFeePercent` vs `appliedFeePercent`) and/or released locked funds (`gatedCapCents`, `walletBalanceCents`, `releasedCents`, `lockedByMaturityCents`, `lockedByLicenceCents`), with a `reason` (max 500 chars) and timestamp `at`.

### Proof of payment
- `receiptUrl` - the first proof; kept for rows written before `proofs` existed and still filled so older readers work.
- `txHash` - the raw on-chain hash for crypto payouts (max 200 chars). Previously only an explorer URL built from it was kept, so members could not copy the hash.
- `proofs[]` - every attachment (`url`, human-readable `label` up to 120 chars shown in the completion email, `uploadedAt`).

### Indexes
- `userId` (single field), `status` (single field).
- `{ status: 1, createdAt: -1 }` - the admin queue filtered by status, newest first.
- `{ userId: 1, walletType: 1, orgId: 1, createdAt: -1 }` - a member's withdrawals for one wallet, merged into their transaction list.

`withdrawalType` only allows `"manual"` today; `currency` defaults to `"USD"`; `timestamps: true` adds `createdAt` / `updatedAt`.

## Exports
- `Withdrawal` - the Mongoose model (`mongoose.model<IWithdrawal>("Withdrawal", ...)`).
- `WITHDRAWAL_WALLET_TYPES` - `["store", "affiliate", "content_rewards"]`; reused by zod validators in the wallet routes and the admin controller, and by `withdrawalPreference.model.ts`.
- `WithdrawalWalletType` - union type of the above.
- `WITHDRAWAL_STATUSES` / `WithdrawalStatus` - `initiated | completed | rejected`.
- `WITHDRAWAL_TYPES` / `WithdrawalType` - `manual`.
- `TAX_TYPES` / `TaxType` - `percent | flat`.
- `IWithdrawalTax` - interface for one tax line.
- `IWithdrawal` - document interface.

## Interfaces
- **Database:** `Withdrawal` (collection `withdrawals`) - defines the schema. References `User`, `Organization`, `WalletAccount`, `GarageAdmin`.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/services/withdrawal.ts` - quote, initiate, complete, reject, list, and the admin/member notification emails.
- `server/controllers/garageAdmin.controller.ts` - super-admin endpoints served by `server/routes/garageAdmin.ts`: `GET /backend/garage-admin/withdrawals`, `GET .../withdrawals/stats`, `POST .../withdrawals/quote`, `POST .../withdrawals`, `POST .../withdrawals/:id/complete`, `POST .../withdrawals/:id/reject`.
- `server/routes/wallet.ts` - member-facing `/backend/wallet/...` endpoints (e.g. `GET /withdrawals`, `GET /withdrawable`) via the service and the wallet-type constant.
- `server/models/withdrawalPreference.model.ts` - imports `WITHDRAWAL_WALLET_TYPES`.

## Notes
- Balance debits/refunds and fee crediting happen in the service; writing to this model directly bypasses them and would leave wallets out of sync.
- `feePercent` defaults to 5 in the schema, but the service resolves the actual percentage (affiliate fee grid, overrides; store and content-rewards wallets are fee-free per `routes/wallet.ts`).
