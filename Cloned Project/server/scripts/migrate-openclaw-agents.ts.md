# `server/scripts/migrate-openclaw-agents.ts`

> Script run by hand; see Notes for what it touches.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 71

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `OpenClawAgent` (server/models/openclawAgent.model.ts) — reads: `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/user.model.ts` — `User`
  - `server/models/openclawAgent.model.ts` — `OpenClawAgent`
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-openclaw-agents.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `OpenClawAgent` (create).
