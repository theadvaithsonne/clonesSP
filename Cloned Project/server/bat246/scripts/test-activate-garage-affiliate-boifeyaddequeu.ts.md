# `server/bat246/scripts/test-activate-garage-affiliate-boifeyaddequeu.ts`

> Temporary test script that forces `isGarageAffiliate: true` on one test user's `Bat246Distributor` record, faking the "$25 Garage Affiliate" purchase so the qualification step can be tested in the UI.

**Kind:** backend one-off script (writes to the production DB; must be reverted) · **Lines:** 68

## Purpose
A BAT246 distributor qualifies by completing several steps tracked as flags on `Bat246Distributor` (`isOfficeMember`, `hasBat246Membership`, `hasPurchasedProduct`, `isGarageAffiliate`). To exercise the Garage Affiliate step without a real payment, this script sets that one flag for the test user `boifeyaddequeu-4758@yopmail.com`. It is marked "TESTING ONLY - temporary" and must be undone with `revert-test-garage-affiliate-boifeyaddequeu.ts`.

## How it works
1. `dotenv.config()`; requires `MONGODB_URI` (throws if unset). **Production database in this project.** Connects, then dynamically imports `User` and `Bat246Distributor`.
2. Finds the user by `USER_EMAIL` and the distributor doc by `userId` (throws if either is missing); logs the "before" state.
3. If `isGarageAffiliate` is already truthy, logs and exits without writing.
4. Computes whether the user would now be fully qualified: `isOfficeMember && hasBat246Membership && hasPurchasedProduct`. Builds `$set: { isGarageAffiliate: true }`, adding `isQualified: true` and `qualifiedAt: now` only if they become qualified now and were not before.
5. Applies the update.
6. Only in that newly-qualified case, mirrors the real purchase-success side effects: `assignDistributorId(userId)` from `server/bat246/services/bat246DistributorId.util.ts` (errors logged) and `maybeCreatePlacementNotification(userId)` from `server/bat246/services/bat246.service.ts` (errors swallowed).
7. Logs the "after" state and disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `User` (collection `users`) - read by email.
  - `Bat246Distributor` (collection `bat246distributors`) - read and update flags.
  - Indirectly, whatever `assignDistributorId` and `maybeCreatePlacementNotification` write, if the user becomes qualified.
- **Environment variables:** `MONGODB_URI` - connection string (production; required).

## Dependencies
- **Internal:** `server/models/user.model.ts`, `server/bat246/models/bat246Distributor.model.ts`, `server/bat246/services/bat246DistributorId.util.ts` (`assignDistributorId`), `server/bat246/services/bat246.service.ts` (`maybeCreatePlacementNotification`) - all imported dynamically.
- **Packages:** `mongoose` (`Types.ObjectId`), `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/test-activate-garage-affiliate-boifeyaddequeu.ts`. Companion scripts: `test-create-up-purchase-boifeyaddequeu.ts` (fakes the matching purchase record) and `revert-test-garage-affiliate-boifeyaddequeu.ts` (undoes both).

## Notes
- Leaves production data in a fake state until the revert script runs.
- The flag only drives the progress-step checkmark. The "missing out on affiliate earnings" banner is driven by a real `UnilevelPlusPurchase`, which is why the companion purchase script exists.
- If the user did become qualified, the revert script does not undo the distributor id or placement notification.
