# `server/bat246/scripts/createAlanKFreeCoupon.ts`

> One-off script that creates (or re-activates) the `BAT246FREE` coupon: an unlimited, never-expiring 100%-off coupon scoped to the BAT246 organisation.

**Kind:** backend one-off script (writes to the production DB) · **Lines:** 114

## Purpose
The BAT246 operator ("Alan K") creates new game boards by buying `bat246_entry` products in the BAT246 office store. This coupon lets those purchases go through at zero cost. The script is idempotent and is run by hand.

## How it works
1. `dotenv.config()`, then connect to `MONGODB_URI` (fallback `mongodb://localhost:27017/garage`). **`MONGODB_URI` is production in this project.**
2. Constants: `ALAN_K_EMAIL` (the operator's email, hard-coded at L25), `COUPON_CODE = "BAT246FREE"`, `BAT246_ORG_ID` (the BAT246 organisation's ObjectId, hard-coded at L29).
3. Looks up the operator by email in `User`; exits with code 1 if not found.
4. Counts `Product` documents with `organizationId` = the BAT246 org and logs the number (informational only; zero products does not stop the script).
5. Looks for an existing `Coupon` with that code:
   - exists and `status === "active"` -> prints its settings (`discountValue`, `maxUsageCount`, `maxUsagePerUser`, `validUntil`, `currentUsageCount`) and does nothing;
   - exists but not active -> sets `status = "active"` and saves;
   - otherwise creates it with: `discountValue: 100`, `scope: "organization"`, `orgId: BAT246_ORG_ID`, `createdBy: <operator _id>`, `createdByType: "founder"`, `applicableTo: ["product"]`, `validFrom: now`, `status: "active"`, `currentUsageCount: 0`. `maxDiscountAmount`, `specificItemIds`, `validUntil`, `maxUsageCount` and `maxUsagePerUser` are deliberately left unset, meaning no cap, all products in the org, no expiry and unlimited uses.
6. Logs the result and disconnects.

## Exports
None. Top-level `run()` executes on load.

## Interfaces
- **Database:**
  - `User` (collection `users`) - read the operator by email.
  - `Product` (collection `products`) - count products in the BAT246 org.
  - `Coupon` (collection `coupons`) - read by `code`; create or update `status`.
- **Environment variables:** `MONGODB_URI` - connection string (production).

## Dependencies
- **Internal:** `server/models/coupon.model.ts` - coupon schema; `server/models/user.model.ts` - operator lookup; `server/models/product.model.ts` - product count.
- **Packages:** `mongoose`, `dotenv`.

## Used by
Not imported anywhere. Run manually, e.g. `npx tsx server/bat246/scripts/createAlanKFreeCoupon.ts` (header shows the old `src/...` ts-node path). `fixCouponOrgId.ts` is a follow-up that rewrites this coupon's `orgId`.

## Notes
- **Security-sensitive:** the coupon is not tied to a user. Anyone who knows the code `BAT246FREE` can get any product in the BAT246 org free, as often as they like, unless the checkout's coupon validation restricts it further. Treat the code as a secret.
- The "re-activated" log message prints `(was ${existing.status})` *after* the status has been set to `"active"`, so it always says "was active".
- When the operator is not found, the script calls `process.exit(1)` without disconnecting from Mongo (harmless for a script).
