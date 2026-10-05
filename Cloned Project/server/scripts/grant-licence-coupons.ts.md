# `server/scripts/grant-licence-coupons.ts`

> One-off grant: push the three reward coupons to the two licence cohorts.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 296

<!-- docgen:auto -->

## Purpose
One-off grant: push the three reward coupons to the two licence cohorts.

  A · bought 4+ licences        → FOUNDERSOFFICE3  (12 cycles Office Pro free)
                                → GETNETWORKCHAINS (3 cycles NetworkChain free)
  B · bought 1 licence BEFORE the free-month launch, plus everyone holding
      2–3 licences              → NETWORKCHAINS1   (1 cycle NetworkChain free)

Nobody is granted the same thing twice. Three independent layers:

  1. The cohorts are disjoint by construction (4+ vs 1 vs 2–3).
  2. Anyone who already received a free NetworkChain month, or already used
     one of these codes, is excluded here before we call anything.
  3. `assignCoupon` is itself idempotent — an existing `active` or `used`
     CouponAssignment is a no-op that deliberately does NOT re-notify, so a
     re-run cannot double-assign or double-email.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `platformcoupons`, `invoices`, `users`
- **Environment variables (`process.env`):** `MONGODB_URI`, `FRONTEND_URL`, `PLATFORM_USER_EMAIL`
- **Timers / queues:** `setTimeout` at L250, L275
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose` — `Types`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/grant-licence-coupons.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--confirm`.
