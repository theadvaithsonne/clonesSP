# `server/bat246/models/bat246B2CoinProductPurchase.model.ts`

> Mongoose model that records each BAT246 entry product ($650 Board Entry or $160 POD Entry) bought with B2 Coins.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 37

## Purpose
B2 Coins are BAT246's internal, non-USD currency (see `bat246B2CoinWallet.model.ts`). When a player pays for an entry product with coins, this collection gives a queryable "who bought what with coins" record, so nobody has to dig through `Invoice` metadata. It is kept apart from the gift ledger (`bat246B2CoinTransaction.model.ts`) because that model requires a recipient (`toUserId`), and a purchase has none: it is a spend from the buyer's own balance.

## How it works
One document per successful coin purchase:

| Field | Type | Notes |
|---|---|---|
| `userId` | ObjectId → `User` | required, indexed; the buyer |
| `productId` | ObjectId → `Product` | required |
| `productLabel` | `"board"` \| `"pod"` | which of the two known entry products |
| `amount` | Number (dollars, min 0) | copied from the invoice's `totalAmount`, never recomputed |
| `invoiceId` | ObjectId → `Invoice` | required, **unique**: at most one row per invoice |
| `createdAt` | Date | defaults to now; schema `timestamps` are off |

`payEntryProductWithB2Coins()` in `server/bat246/services/bat246Layaway.service.ts` writes the row at the end of a purchase, inside a try/catch. A failed write is logged and ignored, so the purchase still succeeds. That function sets `productLabel` to `"board"` when the product id equals its `BOARD_ENTRY_PRODUCT_ID` constant and to `"pod"` otherwise.

## Exports
- `Bat246B2CoinProductPurchase` - Mongoose model registered as `"bat246B2CoinProductPurchases"`.

## Interfaces
- **Database:** collection `bat246b2coinproductpurchases` (Mongoose's default lower-cased plural of the model name). Written only by `bat246Layaway.service.ts`; nothing in the server reads it yet.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`, `Types`.

## Used by
- `server/bat246/services/bat246Layaway.service.ts` (only importer, through `Bat246B2CoinProductPurchase.create`).

## Notes
- Because the write is fire-and-forget, this collection can miss rows. Treat the `Invoice` records as the authority and this collection as a convenience index.
- The unique `invoiceId` index means a retried write for the same invoice fails with a duplicate-key error, which is swallowed.
