# `server/scripts/check-shorupan-stripe-profile.ts`

> Diagnose why shorupan@gmail.com's Stripe card save didn't land.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 214

<!-- docgen:auto -->

## Purpose
Diagnose why shorupan@gmail.com's Stripe card save didn't land.
Checks four things:
  1. User doc paymentProfile.stripe.{customerId, methods}
  2. Stripe Customers with metadata.garageUserId = <shorupan._id>
  3. PaymentMethods attached to those Customers (Stripe side)
  4. Recent PaymentIntents for those Customers (last 24h) —
     inspect their setup_future_usage + status

Diagnosis rules at the bottom of the output.

  npx ts-node --transpile-only src/scripts/check-shorupan-stripe-profile.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/services/stripe.ts` — `getStripeClient`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/check-shorupan-stripe-profile.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
