# `server/scripts/activate-nc-from-saved-card.ts`

> Activates a NetworkChain subscription by charging the buyer's saved card.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 246

<!-- docgen:auto -->

## Purpose
Activates a NetworkChain subscription by charging the buyer's saved card.

── Why this exists ──────────────────────────────────────────────────────
A buyer paid $25 for a Unilevel Plus licence on an invoice minted 129 days
earlier that should never have still been payable. By the time it settled
their 24-hour free-first-month window had closed, so fulfilment correctly
declined to grant a free NetworkChain month — leaving them with a licence
and no subscription. They saved a card during that payment. This charges it
for the first cycle and activates the subscription.

── Why there was no existing path ───────────────────────────────────────
`activateComboFreeFirstMonth({ freeFirstCycle: false })` exists but refuses
without a `bundle`, because that path assumes the subscription money was
ALREADY collected on the UP invoice as part of one cart. It has no concept
of "activate now, collect separately". So this collects the cash first, then
hands the activation a `bundle` describing what was taken — which is also […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `unilevelpluspurchases`, `networkchain_subscriptions`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/activate-nc-from-saved-card.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
