# `server/bat246/models/bat246LostMoneyPayment.model.ts`

> Mongoose model for the audit trail of Lost Money repayment rounds: one row each time a $300 round (or a smaller final round) completes for a Paid List entry.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 19

## Purpose
`Bat246LostMoneyPaid.totalPaid` is a running total. This collection records each completed round behind it. The header comment says only the automatic 3%-of-sale drip writes it and that there is no manual payment path any more.

## How it works
Fields (`timestamps: true`):
- `paidEntryId` (→ `bat246LostMoneyPaid`, required, indexed).
- `amount` (Number, required): the round amount.
- `recordedByEmail` and `note` (Strings, default `""`).
- `source`: enum `["auto"]`, default `"auto"`.

Writers:
- `runLostMoneyAutoPay()` in `bat246LostMoneyAutoPay.service.ts` writes `{ recordedByEmail: "system", note: "Automated 3% sale drip", source: "auto" }` after a round finalises.
- `applyLineup1Give()` in `bat246Layaway.service.ts` writes a row when a lineup1 B2 Coins give completes a round.

## Exports
- `Bat246LostMoneyPayment` - Mongoose model registered as `"bat246LostMoneyPayment"`.

## Interfaces
- **Database:** collection `bat246lostmoneypayments`. Nothing in the server reads it back.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/services/bat246Layaway.service.ts`
- `server/bat246/services/bat246LostMoneyAutoPay.service.ts`

## Notes
- **Enum mismatch (likely bug):** `applyLineup1Give()` creates rows with `source: "layaway"`, which the `["auto"]` enum rejects. The sequence is:
  1. The Paid row has already been `save()`d with the new `totalPaid`.
  2. The giver's and recipient's coin wallets have already changed.
  3. `create()` throws a `ValidationError`.

  The result: no audit row is written, and `giveB2Coins()` fails part-way through. For a layaway request, the request is then marked `insufficient_at_approval` although the coins moved. Adding `"layaway"` to the enum would fix it. The header comment ("written exclusively by the automated drip") is also out of date.
