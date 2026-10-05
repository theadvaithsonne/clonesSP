# `server/scripts/check-and-charge-shorupan-inr-mandate.ts`

> Inspect shorupan's saved INR (Indian issuer) Stripe card + its RBI e-mandate, then attempt a ₹10 MIT charge using the mandate for zero-OTP off-session confirmation.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 181

<!-- docgen:auto -->

## Purpose
Inspect shorupan's saved INR (Indian issuer) Stripe card + its RBI
e-mandate, then attempt a ₹10 MIT charge using the mandate for
zero-OTP off-session confirmation.

Flow:
  1. Load the User doc, filter methods → Indian issuer.
  2. Print mandate id / cap / status from the User doc.
  3. Cross-check with Stripe (mandate.retrieve) — confirms it's active
     and hasn't lapsed on their side.
  4. If mandate is active and ₹10 ≤ cap → chargeSavedPaymentMethod
     with offSession:true + mandate id. Expect status:"succeeded".
  5. If NOT active → don't charge, print why.

Usage:
  npx tsx src/scripts/check-and-charge-shorupan-inr-mandate.ts

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
  - `server/services/stripe.ts` — `chargeSavedPaymentMethod`, `getStripeClient`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/check-and-charge-shorupan-inr-mandate.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
