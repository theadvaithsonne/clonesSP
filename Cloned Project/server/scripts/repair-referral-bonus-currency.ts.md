# `server/scripts/repair-referral-bonus-currency.ts`

> Repairs the referral-bonus payouts that landed in BTC wallets.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 104

<!-- docgen:auto -->

## Purpose
Repairs the referral-bonus payouts that landed in BTC wallets.

`StoreWallet.findOne({userId, orgId})` resolves through the
{userId, orgId, currency} unique index, where "BTC" sorts first — so every
unpinned lookup returned the BTC sibling. services/wallet.ts already fixed
the READ path and explicitly left the write paths alone; referralSignupBonus
inherited the bug from that pattern and has now been pinned to USD.

This moves the already-paid money to the wallets the recipients can actually
see, and clears the transaction rows left behind by testing.

Run with --apply to write. Default is a dry run.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/repair-referral-bonus-currency.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
