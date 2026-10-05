# `server/scripts/latest-whitelabel-purchase.ts`

> Script run by hand; see Notes for what it touches.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 91

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Invoice` (server/models/invoice.model.ts) — reads: `findOne`
  - `WalletTransaction` (server/models/walletTransaction.model.ts) — reads: `find`
  - `User` (server/models/user.model.ts) — reads: `find`, `findById`
  - `OfficeAddon` (server/models/officeAddon.model.ts) — reads: `findOne`
  - `OfficeAddonSubscription` (server/models/officeAddonSubscription.model.ts) — reads: `findOne`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/invoice.model.ts` — `Invoice`
  - `server/models/walletTransaction.model.ts` — `WalletTransaction`
  - `server/models/user.model.ts` — `User`
  - `server/models/officeAddon.model.ts` — `OfficeAddon`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
  - `server/config/whitelabelAddon.ts` — `WHITELABEL_ADDON`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/latest-whitelabel-purchase.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
