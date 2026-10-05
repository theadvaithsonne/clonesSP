# `scripts/enable-nc-topup.ts`

> One-off script that turns on `productConfig.allowsTopUp` for the NetworkChain third-party client record in the **production** database.

**Kind:** backend helper/test script (writes to the configured DB) · **Lines:** 67

## Purpose
NetworkChain (NC) is wired into Garage as a "third-party client" (a document in the `thirdpartyclients` collection, model `ThirdPartyClient`). Whether NC customers may top up their balance is controlled by the flag `productConfig.allowsTopUp` on that document. This script flips that flag to `true` without going through the admin UI. It is run by hand with tsx and is not imported anywhere.

## How it works
1. Loads `.env` from the current working directory via `dotenv.config()` and connects to `MONGODB_URI` — in this project that is the **production** database.
2. Uses the raw `thirdpartyclients` collection (no Mongoose model) to find candidate NC clients matching any of: `name` contains "networkchain" (case-insensitive), `productConfig.productCode` starts with `NC_` or `GU_SUB_NC`, or `productConfig.platformUserEmail` contains "networkchain". It prints each candidate's id, name, product code, current `allowsTopUp` and `isActive`.
3. **Safety rule:** it only updates automatically when exactly one candidate is found. It then runs `updateOne({ _id }, { $set: { "productConfig.allowsTopUp": true } })` and reads the document back to print a verification line.
4. If zero or several candidates match, it prints an error and exits with code 1, **unless** `CLIENT_ID` is set in the environment. In that case it force-updates the document with that `_id` (no check that it is actually an NC client) and prints matched/modified counts.

Run: `npx tsx scripts/enable-nc-topup.ts` or `CLIENT_ID=<id> npx tsx scripts/enable-nc-topup.ts`.

## Exports
None. Top-level script; `run()` executes on load.

## Interfaces
- **Database:** collection `thirdpartyclients` (model `ThirdPartyClient`) - read candidates, write `productConfig.allowsTopUp = true` on one document. Production DB.
- **Environment variables:** `MONGODB_URI` - database to connect to (production); `CLIENT_ID` - optional explicit client `_id` to force the update when the automatic match is ambiguous.

## Dependencies
- **Packages:** `mongoose` - connection and raw collection access; `dotenv` - loads `.env`.

## Used by
Nothing imports it. Run manually with tsx from the repo root.

## Notes
- The write is idempotent (setting `true` again is harmless) and there is no "undo" mode; to revert, set the flag back by hand.
- The `CLIENT_ID` path skips all matching logic, so a wrong id silently modifies a different client (or nothing, if it does not exist).
