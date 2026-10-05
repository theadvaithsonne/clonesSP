# `server/scripts/fix-groups-invite-index.ts`

> One-shot index fix for the `groups` collection.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 118

<!-- docgen:auto -->

## Purpose
One-shot index fix for the `groups` collection.

Background: the old schema declared `inviteCode: { type: String,
default: null }` and the index was `{ inviteCode: 1 }` with
`sparse: true`. A sparse index excludes documents where the field
is *missing*, NOT documents where the field is `null`. So every new
group inserted with the default `null` collided with the existing
groups that already had `null`, producing:

  E11000 duplicate key error collection: roam-admin-prod.groups
  index: inviteCode_1

Fix in code:
  - schema no longer defaults to null
  - index switched to a partial filter that only indexes string
    values of inviteCode […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Group` (server/models/group.model.ts) — **writes:** `syncIndexes`
- **Raw collections:** `groups`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/group.model.ts` — `Group`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/fix-groups-invite-index.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `Group` (syncIndexes).
- Command-line flags referenced: `--apply`.
