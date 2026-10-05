# `server/scripts/list-yopmail-users.ts`

> READ-ONLY: list every user with a yopmail.com email address.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 117

<!-- docgen:auto -->

## Purpose
READ-ONLY: list every user with a yopmail.com email address.

Nothing is deleted here. Prints a table of {_id, email, name, createdAt,
hasOrgs, hasWallets, hasPurchases} so you can confirm the scope before
a follow-up destructive script runs. The exception list below is
highlighted (annotated as [KEEP]) so you can see which would survive
a delete pass.

Usage:
  npx tsx src/scripts/list-yopmail-users.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/list-yopmail-users.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
