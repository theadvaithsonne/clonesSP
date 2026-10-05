# `server/scripts/unflag-hq-cryptobrand.ts`

> One-shot: flip `officeCreatedFromCryptobrand` back to false on Garage HQ.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 67

<!-- docgen:auto -->

## Purpose
One-shot: flip `officeCreatedFromCryptobrand` back to false on
Garage HQ. HQ (`parent: true`) is the platform's root org — every
Garage user auto-joins it — so having the cryptobrand flag on it
caused ensureCryptobrandWallets to eagerly create INR/ETH/BTC
sibling wallets for every user in the system. That was accidental.
This script un-does the flag; the companion
cleanup-hq-cryptobrand-wallets.ts drops the 4,681 zero-balance
sibling wallets those flips created.

USAGE:
  npx tsx src/scripts/unflag-hq-cryptobrand.ts          (dry-run)
  npx tsx src/scripts/unflag-hq-cryptobrand.ts --live   (execute)

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `findOne`; **writes:** `updateOne`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/unflag-hq-cryptobrand.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Organization` (updateOne).
- Command-line flags referenced: `--live`.
