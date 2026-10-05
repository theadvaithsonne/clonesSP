# `server/scripts/diagnose-whitelabel-commission.ts`

> Diagnostic: given a buyer's email, report everything about their whitelabel purchases + commission flow — invoices, addon subscription source, commission breakdown metadata, wallet transactions.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 152

<!-- docgen:auto -->

## Purpose
Diagnostic: given a buyer's email, report everything about their
whitelabel purchases + commission flow — invoices, addon subscription
source, commission breakdown metadata, wallet transactions.

Usage:
  npx tsx src/scripts/diagnose-whitelabel-commission.ts <email>

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `findOne`, `findById`
  - `Invoice` (server/models/invoice.model.ts) — reads: `find`
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `find`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
- **Packages:**
  - `dotenv`
  - `mongoose` — `Types`

## Used by

Entry: run by hand: `npx tsx server/scripts/diagnose-whitelabel-commission.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
