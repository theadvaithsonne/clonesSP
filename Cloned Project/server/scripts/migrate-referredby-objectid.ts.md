# `server/scripts/migrate-referredby-objectid.ts`

> Migration script to convert referredBy from affiliateId string to User ObjectId

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 96

<!-- docgen:auto -->

## Purpose
Migration script to convert referredBy from affiliateId string to User ObjectId

Run: npx ts-node src/scripts/migrate-referredby-objectid.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `migrateReferredByToObjectId` | function | `async migrateReferredByToObjectId()` | 95 |

## Interfaces

- **Raw collections:** `users`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-referredby-objectid.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
