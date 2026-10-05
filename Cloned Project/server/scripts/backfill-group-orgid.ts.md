# `server/scripts/backfill-group-orgid.ts`

> Backfill `orgId` on legacy `groups` documents.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 155

<!-- docgen:auto -->

## Purpose
Backfill `orgId` on legacy `groups` documents.

Background: `orgId` used to be optional on the Group schema, and the
create route only stamped it when the client happened to pass
`?orgId=`. Groups created without it were saved with no org at all.

The list endpoints papered over this by matching
`{ orgId: null }` / `{ orgId: { $exists: false } }` in addition to the
requested org — which meant every org-less group showed up in *every*
org the member switched into, including brand-new ones.

Those endpoints are now strictly org-scoped, so org-less groups would
simply disappear from the sidebar. This script assigns each one an org
before that happens.

Resolution order for a group's org: […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `User` (server/models/user.model.ts) — reads: `find`
- **Raw collections:** `groups`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/models/user.model.ts` — `User`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-group-orgid.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
- Command-line flags referenced: `--apply`.
