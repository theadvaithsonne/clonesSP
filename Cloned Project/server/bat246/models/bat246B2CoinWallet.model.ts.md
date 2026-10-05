# `server/bat246/models/bat246B2CoinWallet.model.ts`

> Mongoose model holding each user's B2 Coins balance, one document per user.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 28

## Purpose
B2 Coins are a BAT246-only currency, given through the layaway system. They are not US dollars. This wallet copies the shape of `storeWallet.model.ts` but lives in its own collection, so a coin balance can never be added to or confused with a real `StoreWallet` balance.

## How it works
Fields (`timestamps: true`):
- `userId` (→ `User`, required, unique, indexed): the wallet owner.
- `balance` (Number, default 0, min 0): coins available to spend.
- `lastTransactionAt` (Date, default `null`).

The wallet stores only what a user has **received**. How much a user has given is always computed from `bat246B2CoinTransaction.model.ts`, never stored here.

`bat246Layaway.service.ts` reads and writes this collection through four helpers:
- `creditB2CoinWallet` finds the wallet (or creates one with balance 0), adds the amount and calls `save()`.
- `debitB2CoinWallet` does the same, then clamps the new balance at 0 and rounds it to cents.
- `getWalletBalance` is a read-only lookup that returns 0 when the user has no wallet. `bat246SnapBackLoan.service.ts` reuses it.

## Exports
- `Bat246B2CoinWallet` - Mongoose model registered as `"bat246B2CoinWallets"`.

## Interfaces
- **Database:** collection `bat246b2coinwallets`, read and written by the layaway service.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/services/bat246Layaway.service.ts` (only importer).

## Notes
- The header comment says coins are "not-yet-redeemable" and that spending them at checkout is future work. That is out of date: `payEntryProductWithB2Coins()` in the layaway service already spends wallet balance on the $650 and $160 entry products, and `walletBalance` is a pool in the give flow.
- Credits and debits load the document, change it in memory and then `save()` it. There is no atomic `$inc` and no version check, so two transactions on the same wallet at the same moment can overwrite each other.
