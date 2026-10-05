# `server/scripts/check-payment-currencies.ts`

> Pre-deploy check for the card-only payment currencies (CAD/EUR/GBP/AED/PHP…).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 137

<!-- docgen:auto -->

## Purpose
Pre-deploy check for the card-only payment currencies (CAD/EUR/GBP/AED/PHP…).

Adding a currency touches one list (utils/exchangeRate.ts) — but three
things can still go wrong silently and only show up in production:

  1. The invoice's `paymentCurrency` enum rejects it. The Stripe webhook
     writes `pi.currency` into that field AFTER the card is charged, so a
     missing enum value means a paid invoice that fails to save.
  2. The option list reorders. The checkout reads the FIRST currency's
     method list to decide whether to show the crypto tile; a card-only
     currency landing first hides crypto for everyone (Sep 2026).
  3. The Stripe account can't present in it. Presentment currencies are
     per-account; a PaymentIntent that can't be created is a dead tile.

This asserts all three for every extra currency, plus that a live rate
resolves. The Stripe check creates an uncharged PaymentIntent and cancels […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`, `STRIPE_SECRET_KEY`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`
  - `zod` — `z`

## Used by

Entry: run by hand: `npx tsx server/scripts/check-payment-currencies.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
