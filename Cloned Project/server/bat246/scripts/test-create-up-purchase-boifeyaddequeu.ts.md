# `server/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts`

> Temporary test script that inserts a fake, clearly marked $25 `UnilevelPlusPurchase` for one test user so the affiliate-earnings banner disappears for them.

**Kind:** backend one-off script (writes to the production DB; must be reverted) · **Lines:** 61

## Purpose
Companion to `test-activate-garage-affiliate-boifeyaddequeu.ts`. That script sets `Bat246Distributor.isGarageAffiliate`, which drives the "$25 Garage Affiliate" progress checkmark. The separate "You're missing out on all affiliate earnings" banner reads `GET /backend/wallet/affiliate/balance` (route in `server/routes/wallet.ts`, mounted at `/wallet`), whose `hasPurchasedUnilevelPlus` field depends on the user having an actual `UnilevelPlusPurchase` document. This script creates that document for the test user `boifeyaddequeu-4758@yopmail.com`.

## How it works
1. `dotenv.config()`; requires `MONGODB_URI` (throws if unset). **Production database in this project.** Dynamically imports `User`, `UnilevelPlusPurchase`, `UnilevelPlusPlan`.
2. Finds the user by `USER_EMAIL` (throws if missing).
3. If the user already has any `UnilevelPlusPurchase`, logs it and exits without writing.
4. Takes the oldest `UnilevelPlusPlan` (`sort({ createdAt: 1 })`) as the plan reference; throws if there is none.
5. Creates the purchase: `userId`, `planId`, `paymentId: "TEST-<userId>-<timestamp>"`, `amount: 25`, `currency: "USD"`, `status: "active"`, `purchasedAt: now`, `metadata: { test: true, createdBy: "test-create-up-purchase-boifeyaddequeu.ts" }`.
6. Logs the created doc and disconnects; errors exit with code 1.

The `TEST-` payment-id prefix and `metadata.test: true` are the markers `revert-test-garage-affiliate-boifeyaddequeu.ts` uses to delete exactly this record.

## Exports
None.

## Interfaces
- **Database:**
  - `User` (collection `users`) - read by email.
  - `UnilevelPlusPlan` - read the oldest plan.
  - `UnilevelPlusPurchase` - read; create one test record.
- **Environment variables:** `MONGODB_URI` - connection string (production; required).

## Dependencies
- **Internal:** `server/models/user.model.ts`, `server/models/unilevelPlusPurchase.model.ts`, `server/models/unilevelPlusPlan.model.ts` - imported dynamically.
- **Packages:** `mongoose` (`Types.ObjectId`), `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/test-create-up-purchase-boifeyaddequeu.ts`; undo with the revert script.

## Notes
- Until reverted, the fake purchase may be counted by any report, commission or wallet logic that reads `UnilevelPlusPurchase` without filtering `metadata.test`.
- The plan chosen is simply the oldest one; its price is not checked against the hard-coded `amount: 25`.
