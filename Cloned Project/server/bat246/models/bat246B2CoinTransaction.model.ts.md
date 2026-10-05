# `server/bat246/models/bat246B2CoinTransaction.model.ts`

> Mongoose model for the immutable B2 Coins gift ledger: one row per gift from one user to another, with a per-pool breakdown.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 51

## Purpose
BAT246's "layaway" feature lets eligible players give B2 Coins to other players toward an entry product. This ledger is the **only** record of how much a giver has given, overall and from each eligibility pool. No running total is stored on the giver's side, so nothing can drift out of sync. `computeLayawayEligibility()` in `bat246Layaway.service.ts` aggregates this collection whenever it needs those totals.

## How it works
**Main schema** (`timestamps: false`, with a manual `createdAt` that defaults to now):
- `fromUserId` (→ `User`, required, indexed): the giver.
- `toUserId` (→ `User`, required, indexed): the recipient, whose `Bat246B2CoinWallet` is credited.
- `amount` (Number, min 0).
- `productId` (→ `Product`, default `null`): set when the gift goes toward a specific entry product ($650 board or $160 POD). The comment says the server then derives `amount` from the real product price and never trusts the client.
- `breakdown` (required array of `{ pool, amount }`, no `_id`): how the gift was split across eligibility pools. Caps stack across pools that qualify at the same time, so one gift can draw from several. The service allocates pools largest-cap-first.
- `requestId` (→ `bat246LayawayRequests`, default `null`): set when the gift fulfilled a `Bat246LayawayRequest` through the approve flow, not a direct give.

**Pool names.** The comment lists `homePlate`, `podLastSale`, `leaderboard`, `matchingBonus`, `lineup1` and `adminBypass`. The service's `PoolKey` type also includes `walletBalance`. `pool` is a free string with no enum, so the schema accepts any of these. The `lineup1` pool has a side effect: `giveB2Coins()` feeds it into the Lost Money auto-pay round (`roundAccumulated` on `Bat246LostMoneyPaid`).

**Indexes:** `{ fromUserId: 1, createdAt: -1 }` and `{ toUserId: 1, createdAt: -1 }`, for giver and recipient history.

## Exports
- `Bat246B2CoinTransaction` - Mongoose model registered as `"bat246B2CoinTransactions"`.

## Interfaces
- **Database:** collection `bat246b2cointransactions`. `bat246Layaway.service.ts` creates rows (`create`) and reads them (`find`) for eligibility and history.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/services/bat246Layaway.service.ts` (only importer).

## Notes
- Treat the ledger as append-only. Editing or deleting rows changes every giver's computed eligibility.
- Coin purchases of products are logged separately in `bat246B2CoinProductPurchase.model.ts`.
