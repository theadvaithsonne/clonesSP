# `server/scripts/migrate-remove-earngpt.ts`

> Migration script to remove legacy EarnGPT data This removes the old third-party EarnGPT integration fields that have been replaced by the native affiliate system.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 116

<!-- docgen:auto -->

## Purpose
Migration script to remove legacy EarnGPT data
This removes the old third-party EarnGPT integration fields that have been replaced
by the native affiliate system.

Run: npx ts-node src/scripts/migrate-remove-earngpt.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `removeEarnGPTData` | function | `async removeEarnGPTData()` | 115 |

## Interfaces

- **Raw collections:** `users`, `organizations`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:** none
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-remove-earngpt.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
