# `server/scripts/migrate-identity-indexes.ts`

> Makes `phone` a first-class identity alongside `email`.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 114

<!-- docgen:auto -->

## Purpose
Makes `phone` a first-class identity alongside `email`.

Three index changes on `users`:

  email_1   is `unique` but NOT sparse, so a SECOND user without an email
            collides on null. That is the single thing preventing a
            phone-only signup. Recreated as unique + partial.
  phone_1   new, unique + partial. Without it `findOne({ phone })` has no
            uniqueness guarantee and no index — it would silently return an
            arbitrary one of several matching accounts.
  email_ci  a redundant NON-unique duplicate of email_1 (identical key
            {email:1}). Dropped; it costs writes and buys nothing.

`partialFilterExpression: { $type: "string" }` rather than `sparse: true`:
sparse only skips documents where the field is ABSENT, so an explicit
`email: null` write would still collide. Partial-on-type skips both. […]

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

Entry: run by hand: `npx tsx server/scripts/migrate-identity-indexes.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
