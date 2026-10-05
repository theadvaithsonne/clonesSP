# `server/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts`

> One-off cleanup that undoes both temporary test scripts for the test user `boifeyaddequeu-4758@yopmail.com`: it unsets the forced `isGarageAffiliate` flag and deletes the fake Unilevel Plus purchase.

**Kind:** backend one-off script (writes to and deletes from the production DB) · **Lines:** 68

## Purpose
`test-activate-garage-affiliate-boifeyaddequeu.ts` and `test-create-up-purchase-boifeyaddequeu.ts` faked a "$25 Garage Affiliate" purchase for one test user so the BAT246 qualification UI could be exercised. This companion script returns that user's records to their pre-test shape.

## How it works
1. Requires `MONGODB_URI` (throws if unset). **Production database in this project.** Connects, then dynamically imports `User`, `Bat246Distributor` and `UnilevelPlusPurchase`.
2. Finds the user by `USER_EMAIL` (throws if missing) and their `Bat246Distributor` doc by `userId` (throws if missing). Logs the "before" state.
3. Builds an `$unset`:
   - always `isGarageAffiliate` (the field did not exist before the test, not even as `false`);
   - `isQualified` and `qualifiedAt` too, but only if they are set **and** the user does not have both `hasBat246Membership` and `hasPurchasedProduct` true - that is, only when the qualification could only have come from the test flag.
4. Applies the `$unset` and logs the "after" state.
5. Deletes the test purchase with `UnilevelPlusPurchase.deleteOne({ userId, "metadata.test": true, paymentId: /^TEST-/ })`. All three conditions must match, so a real purchase is never removed. Logs the deleted count.
6. Disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:**
  - `User` (collection `users`) - read by email.
  - `Bat246Distributor` (model `bat246Distributors`, collection `bat246distributors`) - read; `$unset` fields.
  - `UnilevelPlusPurchase` - delete one test-marked document.
- **Environment variables:** `MONGODB_URI` - connection string (production; required).

## Dependencies
- **Internal:** `server/models/user.model.ts`, `server/bat246/models/bat246Distributor.model.ts`, `server/models/unilevelPlusPurchase.model.ts` - all imported dynamically after connecting.
- **Packages:** `mongoose` (`Types.ObjectId`), `dotenv`.

## Used by
Not imported anywhere. Run by hand after testing, e.g. `npx tsx server/bat246/scripts/revert-test-garage-affiliate-boifeyaddequeu.ts` (header shows the old `src/...` path).

## Notes
- It deliberately does **not** undo a `distributorId` assignment or a placement notification. Those would only exist if the activation script found the user fully qualified, which the header says was not the case when it ran. Check manually if in doubt.
- The qualification check here looks at `hasBat246Membership` and `hasPurchasedProduct`, while the activation script also required `isOfficeMember`; the two conditions are not exact mirrors.
