# `server/scripts/check-stripe-account.ts`

> Fetch the current Stripe account's country + supported currencies.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 60

<!-- docgen:auto -->

## Purpose
Fetch the current Stripe account's country + supported currencies.
Answers the "can we shift INR cards to Stripe" question definitively.

Usage:
  npx ts-node --transpile-only src/scripts/check-stripe-account.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/services/stripe.ts` — `getStripeClient`
- **Packages:**
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/check-stripe-account.ts`.
