# `server/scripts/migrate-office-addon-sub-razorpay-index.ts`

> One-shot migration: rebuild the OfficeAddonSubscription `razorpaySubscriptionId` unique index as SPARSE-unique.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 89

<!-- docgen:auto -->

## Purpose
One-shot migration: rebuild the OfficeAddonSubscription
`razorpaySubscriptionId` unique index as SPARSE-unique.

Why: prod's legacy index is a plain unique on
`razorpaySubscriptionId`, created before the invoice-driven
whitelabel/cryptosub flows existed. Non-sparse unique treats a
missing/null value as "the null value", so at most ONE doc without
a razorpaySubscriptionId can exist (Chamak's manual grant already
occupies that slot). Any second invoice-driven activation attempt
fails with E11000 → activation silently no-ops → commission never
fires.

The Mongoose schema already declares this index as sparse-unique;
Mongoose does NOT auto-drop-and-recreate mismatched indexes on
connect, so we have to migrate deliberately.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/officeAddonSubscription.model.ts` — `OfficeAddonSubscription`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-office-addon-sub-razorpay-index.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
