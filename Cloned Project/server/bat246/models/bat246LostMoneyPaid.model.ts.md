# `server/bat246/models/bat246LostMoneyPaid.model.ts`

> Mongoose model for the Lost Money "Paid List": one row per approved claimant. It tracks the amount approved for repayment, how much has been repaid, and their place in the automatic 3%-of-sale repayment queue.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 49

## Purpose
When an admin approves someone's lost-money claim, that person gets a row here. `runLostMoneyAutoPay()` in `bat246LostMoneyAutoPay.service.ts` runs on every real BAT246 sale. It moves 3% of the sale from the owner's Garage `StoreWallet` into the wallet of whoever is first in line, in rounds of up to $300. This document is the queue entry, the running tally and the source of the public Paid List.

## How it works
Fields (`timestamps: true`):
- **Who:**
  - `name` (required, trimmed);
  - `userId` (→ `User`, default `null`): the linked Garage account. Only rows with a `userId` can receive automatic wallet deposits;
  - `email`;
  - `claimId` (→ `bat246LostMoneyClaims`, default `null`).
- **Amounts:**
  - `reportedLoss` (String): set when the row is created.
  - `approvedAmount` (Number, required): the most the person will be repaid.
  - `totalPaid` (Number, required, default 0): moves only in whole completed rounds.
  - `lastPaymentAmount` and `lastPaymentAt`: the most recent completed round.
- **Queue:** `order` (Number), the admin-controlled position. When a round completes, the person moves to the end of the line (highest `order` + 1).
- **Drip state:**
  - `roundAccumulated`: real money already deposited toward the current round but not yet counted in `totalPaid`. The round target is `min($300, approvedAmount - totalPaid)`.
  - `fullyRepaid`: set once `totalPaid >= approvedAmount`. The row is then skipped by auto-pay but stays visible as history.
- **`movedToLineupAt`** controls the 90-day waiting period, and has **no schema default on purpose**. It has three states:
  - field absent: a legacy row, treated as already active;
  - `null`: parked in the "90 Days Waiting Period" grid and not eligible for auto-pay;
  - a Date: an admin clicked "Move to Lineup", so the row is in the "No Wait Lineup" grid and eligible.

  In MongoDB, `{ movedToLineupAt: null }` matches both absent and null. So callers use `$exists` explicitly: the routes' `ACTIVE_LINEUP_FILTER` is `{$or: [{$exists: false}, {$ne: null}]}` and `WAITING_LINEUP_FILTER` is `{$exists: true, $eq: null}`.

Who writes to it:
- **Admin routes** in `bat246LostMoney.routes.ts`:
  - `POST /paid/add` either creates a row (in the waiting grid unless `lineup: "active"` is passed) or, for a person already on the list, **adds to `approvedAmount`**;
  - `/paid/:id/edit-amount`, `/edit-name`, `/move-to-lineup`, `/move-to-waiting`, `/delete`;
  - `/paid/swap-order`.
- **`runLostMoneyAutoPay()`** takes the first active, not-yet-repaid row with a `userId` (sorted by `order`) and deposits into that user's wallet. It writes a `Bat246LostMoneyPayment` row when a round completes.
- **`applyLineup1Give()`** in `bat246Layaway.service.ts` lets the person at #1 in the lineup convert their round into B2 Coins instead of cash. It uses the same round arithmetic.

## Exports
- `Bat246LostMoneyPaid` - Mongoose model registered as `"bat246LostMoneyPaid"`.

## Interfaces
- **Database:** collection `bat246lostmoneypaids` (Mongoose's pluralised name).
- **Endpoints using it** (mounted at `/bat246/lostmoney`):
  - `GET /backend/bat246/lostmoney/paid`: public. Returns only rows with `totalPaid > 0` and exposes no admin-only fields.
  - `GET /backend/bat246/lostmoney/paid/admin`: admin.
  - The `/paid/*` mutation routes above.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246LostMoney.routes.ts`
- `server/bat246/services/bat246Layaway.service.ts`
- `server/bat246/services/bat246LostMoneyAutoPay.service.ts`
- `server/scripts/bat246-move-lostmoney-lineup-to-waiting.ts`: a manual script that bulk-updates `movedToLineupAt` against `MONGODB_URI` (production).

## Notes
- Two in-code comments are out of date:
  - "approvedAmount ... set once" — it is later raised by repeat `/paid/add` calls and can be overwritten by `/paid/:id/edit-amount`.
  - "Add ... tops up their running total" — a repeat add raises `approvedAmount`, not `totalPaid`.
- Never add a schema default to `movedToLineupAt`. A default would collapse the absent and null states and silently pause or unpause people.
- Auto-pay and the lineup1 give both update the row by loading and saving it, with no concurrency guard.
