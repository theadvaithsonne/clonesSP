# `server/bat246/scripts/addTestUsers10to19.ts`

> One-off script that creates ten test Garage users ("bat test user 10" to "bat test user 19") and enrols them in the BAT246 organisation.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 89

## Purpose
Used during BAT246 testing to get a batch of throwaway accounts that can buy board entries. Each account uses a `yopmail.com` disposable inbox. The script is idempotent: existing users are not recreated, only added to the org if missing.

## How it works
1. Imports `setSignupOffersEnabled` from `server/services/signupOffer.ts` and calls `setSignupOffersEnabled(false)` at module load. The `User` model has a post-save hook that fires `sendSignupOffer()` for brand-new users; with the kill switch off, `sendSignupOffer` returns `{ sent: false, reason: "disabled" }`, so ten `User.create()` calls do not send ten offer emails.
2. Builds `TEST_USERS`: `name: "bat test user N"`, `email: "battestuserN@yopmail.com"` for N = 10..19.
3. Loads `.env` (`dotenv.config()`), connects to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **`MONGODB_URI` is the production database in this project.**
4. Resolves the BAT246 org from the first `Product` tagged `bat246_entry` (`organizationId`). Exits with code 1 if none is found.
5. For each test user:
   - not found by email -> `User.create({ name, email, role: "user", isVerified: true, organizations: [{ organization: orgId, role: "stakeholder" }] })`;
   - found and not in the org -> `$addToSet` an `{ organization: orgId, role: "stakeholder" }` entry;
   - found and already in the org -> logged only.
6. Prints created / already-existed counts and disconnects. Errors exit with code 1.

## Exports
None. Top-level `run()` executes on load.

## Interfaces
- **Database:**
  - `Product` (collection `products`) - read: the `bat246_entry` product to find the org.
  - `User` (collection `users`) - read by email; write: create users, `$addToSet` org membership.
- **Environment variables:** `MONGODB_URI` - connection string (production).
- **External services:** none directly; the sign-up offer email that `User` creation would normally trigger is disabled.

## Dependencies
- **Internal:** `server/models/user.model.ts` - user creation and update; `server/models/product.model.ts` - org lookup via the entry product; `server/services/signupOffer.ts` - `setSignupOffersEnabled(false)` kill switch.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/addTestUsers10to19.ts` (the header still shows the old `src/...` ts-node path). `fixMissingAB8Entry.ts` expects `battestuser13@yopmail.com` to exist and tells you to run this script first.

## Notes
- Creates real, verified (`isVerified: true`) accounts in production without passwords. Anyone who controls the public yopmail inbox could use OTP login to sign in as them.
- `setSignupOffersEnabled(false)` is called before the `Product` import line but after the `User` import; this order is fine because the flag is only read when a user is saved.
- Other `User` post-save hooks (for example the downline-tree sync) still run, but they only act on users with `referredBy`, which these users do not have.
