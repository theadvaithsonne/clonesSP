# `server/scripts/backfill-support-chats.ts`

> Backfill support chats for every user who completed their profile before support chats existed (services/supportChat.ts).

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 86

<!-- docgen:auto -->

## Purpose
Backfill support chats for every user who completed their profile before
support chats existed (services/supportChat.ts).

New users get theirs from routes/profile.ts; this covers everyone already
past that point. Safe to re-run: ensureSupportGroup creates a missing chat
and otherwise only adds members that are missing (a newly added admin, a
changed upline or agent) and re-derives the chat's name, so a second run is
a membership top-up — and the way to rename existing chats after the name
format changes.

Also creates the two Group indexes the feature relies on — the unique
"one support chat per user" index must exist BEFORE groups are created in
bulk, or a racing profile save could produce a duplicate.

Usage:
  npx tsx src/scripts/backfill-support-chats.ts          # dry run (counts only) […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
  - `Group` (server/models/group.model.ts) — reads: `find`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
  - `server/models/group.model.ts` — `Group`
  - `server/services/supportChat.ts` — `activeStaffUserIds`, `ensureSupportGroup`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-support-chats.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
