# `server/scripts/migrate-dm-to-org.ts`

> Module exporting `migrateDMsToOrg`.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 159

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `migrateDMsToOrg` | function | `async migrateDMsToOrg(targetOrgId: string)` | 158 |

## Interfaces

- **Database (Mongoose models used):**
  - `Message` (server/models/message.model.ts) — reads: `countDocuments`; **writes:** `updateMany`
- **Environment variables (`process.env`):** `MONGODB_URI`
- **Timers / queues:** `setTimeout` at L72

## Dependencies

- **Internal:**
  - `server/models/message.model.ts` — `Message`
- **Packages:**
  - `mongoose`
  - `dotenv` — `config`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-dm-to-org.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Message` (updateMany).
