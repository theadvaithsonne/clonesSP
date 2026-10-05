# `server/scripts/rollback-phone-unique-index.ts`

> Drops the `phone_1` unique index.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 83

<!-- docgen:auto -->

## Purpose
Drops the `phone_1` unique index.

That index was created ahead of the phone-login module, but the DEPLOYED
code knows nothing about it: `/auth/phone/verify-otp` and `PUT /profile`
both write `phone` with no duplicate handling, so a number already held by
another account raises E11000 and surfaces to the user as a 500.

  E11000 duplicate key error ... index: phone_1 dup key: { phone: "+91…" }

The guards that make the index safe are written but not shipped. Until they
are, the index has to go — this reverts the database to the state the
running code was built for.

Re-create it with scripts/migrate-identity-indexes.ts as part of deploying
the module. Nothing here touches the phone VALUES; the dedupe, country-code
repair and E.164 canonicalisation all stand. […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Raw collections:** `users`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/rollback-phone-unique-index.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
