# `server/scripts/charge-shorupan-inr-ten.ts`

> Attempt a ₹10 CIT charge on shorupan's saved Indian card.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 142

<!-- docgen:auto -->

## Purpose
Attempt a ₹10 CIT charge on shorupan's saved Indian card. Since RBI
mandates OTP-per-charge for saved Indian cards (unless a pre-
registered e-mandate exists), the server-side PI can only get to
`requires_action` — the actual OTP has to happen in a browser.

Two outcomes possible:
  1. `next_action.type === "redirect_to_url"` — Stripe hosts a 3DS
     confirmation page. Print the URL; shorupan opens it, enters
     OTP, done. Zero code needed on our side.
  2. `next_action.type === "use_stripe_sdk"` — requires Stripe.js
     in a browser (our normal FE flow). Fallback path: print the
     client_secret + a browser console snippet he can run on any
     Stripe-loaded page.

Usage:
  npx ts-node --transpile-only src/scripts/charge-shorupan-inr-ten.ts

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
  - `server/services/stripe.ts` — `chargeSavedPaymentMethod`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/charge-shorupan-inr-ten.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
