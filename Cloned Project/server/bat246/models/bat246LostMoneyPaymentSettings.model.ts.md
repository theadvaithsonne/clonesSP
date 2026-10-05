# `server/bat246/models/bat246LostMoneyPaymentSettings.model.ts`

> Singleton Mongoose model holding the global on/off switch for Lost Money repayments and the history of every paused interval.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 28

## Purpose
The admin Paid List page has a switch that pauses the automatic 3%-of-sale Lost Money drip. `runLostMoneyAutoPay()` reads this document on every real BAT246 sale. When `paymentsEnabled === false` it does nothing, and the money stays with the owner's wallet. The pause history lets the 90-day waiting-period countdown freeze while payments are stopped.

## How it works
Fields (`timestamps: true`):
- `paymentsEnabled` (Boolean, default `true`).
- `updatedByEmail` (default `""`).
- `pauseHistory`: an array of `{ pausedAt (required), resumedAt (default null) }`, default `[]`. An interval with `resumedAt: null` is a pause still in progress.

In `bat246LostMoney.routes.ts`:
- `getHealedPaymentSettings()` creates the singleton if it is missing. If payments are off but no interval is open (a document from before the history existed), it opens one starting at `updatedAt`.
- `POST /payments/toggle` opens an interval when payments go from on to off, and closes the open one when they go from off to on.
- `computeEligibleInfo(createdAt, pauseHistory)` subtracts every paused interval that overlaps `[createdAt, now]` from the 90-day period. Paused days therefore do not count toward a Paid List row's waiting time.

## Exports
- `Bat246LostMoneyPaymentSettings` - Mongoose model registered as `"bat246LostMoneyPaymentSettings"`.

## Interfaces
- **Database:** collection `bat246lostmoneypaymentsettings`, expected to hold exactly one document.
- **Endpoints using it** (mounted at `/bat246/lostmoney`, both `requireAuth` + `requireAlanK`):
  - `GET /backend/bat246/lostmoney/payments/status`
  - `POST /backend/bat246/lostmoney/payments/toggle` (body `{ enabled }`)

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246LostMoney.routes.ts`
- `server/bat246/services/bat246LostMoneyAutoPay.service.ts`

## Notes
- Nothing enforces a single document; `findOne()` with no filter is used everywhere.
- If the document is missing, auto-pay treats payments as enabled, because it only stops on an explicit `false`.
