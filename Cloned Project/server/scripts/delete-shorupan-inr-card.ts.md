# `server/scripts/delete-shorupan-inr-card.ts`

> Detach the Indian card (•••• 4009) from shorupan's Stripe Customer + remove from paymentProfile.stripe.methods so he can re-save it via the new mandate-enabled SetupIntent flow (zero-OTP INR reuse).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 91

<!-- docgen:auto -->

## Purpose
Detach the Indian card (•••• 4009) from shorupan's Stripe Customer +
remove from paymentProfile.stripe.methods so he can re-save it via
the new mandate-enabled SetupIntent flow (zero-OTP INR reuse).

Usage:
  npx ts-node --transpile-only src/scripts/delete-shorupan-inr-card.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/services/stripe.ts` — `detachPaymentMethod`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/delete-shorupan-inr-card.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `User` (updateOne).
