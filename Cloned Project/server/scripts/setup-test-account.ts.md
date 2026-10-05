# `server/scripts/setup-test-account.ts`

> Put a TEST account (App Store review, QA) into the fully-onboarded state a real affiliate reaches after completing their profile and taking the combo offer — without a card, an OTP, or anyone getting paid.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 202

<!-- docgen:auto -->

## Purpose
Put a TEST account (App Store review, QA) into the fully-onboarded state a
real affiliate reaches after completing their profile and taking the combo
offer — without a card, an OTP, or anyone getting paid.

  1. Profile complete: name, an Indian location, a verified +91 number.
  2. Unilevel Plus licence: a $0 UP invoice, marked paid and fulfilled by
     the real `fulfillInvoice` path. The line is priced at 0 (not
     discounted from $25) so `subtotal` is 0 and fulfilment SKIPS the
     commission run — a comped test seat must not pay the upline $25.
  3. NetworkChain subscription: `activateComboFreeFirstMonth`, the exact
     free-first-month path a combo buyer takes. Fulfilment fires the
     partner webhook and NetworkChains flips `networkchain_subscriptions`
     to active for a month. Cycle 2 will be minted by the cron and, with
     no card on file, sit unpaid — fine for a review account.

Every step is idempotent: an existing licence / subscription / verified […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`
- **Timers / queues:** `setTimeout` at L184

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/setup-test-account.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`, `--phone`, `--name`.
