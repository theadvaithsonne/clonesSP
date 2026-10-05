# `server/models/storeWallet.model.ts`

> Mongoose model for per-user, per-organisation, per-currency store wallets (the balances that commissions credit and payouts debit), with a query hook that defaults currency-less lookups to the USD wallet.

**Kind:** Mongoose model · **Lines:** 110

## Purpose
`StoreWallet` is the central balance ledger row behind wallets, commissions, bonds, HQ wallets, referral bonuses, BAT246 payouts and many admin tools. It has 63 importers. Each (user, org) pair has a USD wallet. Cryptobrand orgs also get sibling wallets in other currencies (INR, ETH, BTC, driven by `server/config/cryptobrandCurrencies.ts`), linked back to the USD "parent".

## How it works
### Fields
| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId -> `User` | required, indexed |
| `orgId` | ObjectId -> `Organization` | required, indexed |
| `balance` | Number | required, default 0, **min 0** (cannot go negative at validation) |
| `currency` | String | default `"USD"` |
| `parentWalletId` | ObjectId -> `StoreWallet` | indexed; set on non-USD sibling wallets, pointing at the USD wallet for the same (user, org); undefined on legacy and non-cryptobrand wallets |
| `isActive` | Boolean | default true |
| `lastTransactionAt` | Date | |
`timestamps: true`.

### Indexes
- `{ userId, orgId, currency }` is **unique**. The old unique `{ userId, orgId }` index blocked multi-currency wallets. `server/scripts/migrate-store-wallet-currency-index.ts` drops that old index; the source comment still refers to it as `src/scripts/...`.
- `{ orgId, balance: -1 }` is for org-level listings (such as top balances).

### USD-pin safety net (L62-L107)
`pinCurrencyToUsdIfMissing` is registered as a `pre("findOne")` and `pre("findOneAndUpdate")` hook. With several currency wallets per (user, org), a currency-less `findOne({ userId, orgId })` would return whichever document sorts first, often BTC, and USD credits would land on the wrong ledger. The hook rewrites the filter to add `currency: "USD"` only when all of these hold:
- the filter has no `currency` key (an explicit currency is respected);
- the filter has no `_id`, `$or` or `$and`;
- both `userId` and `orgId` are present and are scalars or ObjectIds, not operator objects such as `{ $in: [...] }`.
`.find()` is deliberately left alone, so multi-wallet enumerators such as `getAllUserWallets` in `server/services/wallet.ts` still see every currency.

## Exports
- `StoreWallet` - Mongoose model `"StoreWallet"` (default collection `storewallets`). No TypeScript interface is exported, so documents are loosely typed.

## Interfaces
- **Database:** `StoreWallet` (collection `storewallets`). Read and written widely (credits, debits, provisioning, audits, migrations).

## Dependencies
- **Packages:** `mongoose`. It is also `require`d inside the hook for the `Types.ObjectId` instance check.

## Used by
`scripts/test-franchise-e2e.ts`, `server/bat246/services/bat246LostMoneyAutoPay.service.ts`, `server/bat246/services/bat246Wallet.util.ts`, `server/controllers/garageAdmin.controller.ts`, `server/routes/bond.ts`, `server/routes/ecommerceWallet.ts`, `server/routes/garageAdminReferralBonus.ts`, `server/routes/garageAdminStoreWallets.ts`, `server/routes/hifiInvoice.ts`, `server/routes/wallet.ts`, `server/routes/walletHq.ts`, many maintenance scripts under `server/scripts/` (for example `migrate-wallets.ts`, `migrate-sweep-locked-earnings.ts`, `cleanup-hq-cryptobrand-wallets.ts`, `delete-yopmail-users.ts`, `diagnoseAuctionSettlement.ts`), and 38 more.

## Notes
- The USD pin is a **safety net, not the primary defence**. New code should pass `currency: "USD"` (or the intended currency) explicitly.
- `updateOne` / `updateMany` / `find` are **not** pinned. A currency-less `updateOne({ userId, orgId }, ...)` can still hit an arbitrary currency wallet.
- `min: 0` on `balance` applies only to validated writes (`save`, or updates with `runValidators`). Raw `$inc` updates can still push it below zero unless the caller guards the filter.
- Many scripts that import this model run against the production database (`MONGODB_URI`).
