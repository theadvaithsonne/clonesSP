# `server/bat246/scripts/fixCouponOrgId.ts`

> One-off script that sets the `orgId` of the `BAT246FREE` coupon to the BAT246 organisation's ObjectId.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 25

## Purpose
Follow-up to `createAlanKFreeCoupon.ts`. The organisation-scoped free-entry coupon must carry the correct BAT246 org id, or checkout will not accept it in the BAT246 office store. This script corrects the field on the existing coupon document.

## How it works
- `dotenv.config()`, connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **Production database in this project.**
- Uses the raw driver: `db.collection("coupons").updateOne({ code: "BAT246FREE" }, { $set: { orgId: ObjectId(CORRECT_ORG_ID) } })`, where `CORRECT_ORG_ID` is hard-coded at L6 (the same id as `BAT246_ORG_ID` in `createAlanKFreeCoupon.ts`).
- Logs matched/modified counts and disconnects. Errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:** collection `coupons` - update one document by `code`.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Packages:** `mongoose` (raw collection access), `dotenv`.

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/fixCouponOrgId.ts`.

## Notes
- Bypasses Mongoose models, so no schema validation or hooks run.
- It always prints "orgId corrected", even when `Matched: 0` (the coupon does not exist).
- The current `createAlanKFreeCoupon.ts` already writes this org id, so this script is only needed for a coupon created by an older version.
