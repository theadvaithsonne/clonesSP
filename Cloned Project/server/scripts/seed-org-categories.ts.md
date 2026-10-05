# `server/scripts/seed-org-categories.ts`

> Seed the OrgCategory collection from the existing world: 1.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 108

<!-- docgen:auto -->

## Purpose
Seed the OrgCategory collection from the existing world:
  1. Every `Organization.category` value in the DB (case-insensitive
     dedup — "Tech" and "tech" collapse to one).
  2. The 10 hardcoded FE defaults so a fresh install still has a
     reasonable picker even before any org has been created.

Safe to re-run. Categories that already exist (matched case-insensitive
on `name`) are skipped. `createdByAdminId` is left null on seed rows so
an admin can tell seeded values apart from ones they added later.

Usage:
  npx ts-node --transpile-only src/scripts/seed-org-categories.ts            # dry-run
  npx ts-node --transpile-only src/scripts/seed-org-categories.ts --apply    # writes

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Database (Mongoose models used):**
  - `Organization` (server/models/organization.model.ts) — reads: `distinct`
  - `OrgCategory` (server/models/orgCategory.model.ts) — reads: `find`, `findOne`; **writes:** `create`
- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/organization.model.ts` — `Organization`
  - `server/models/orgCategory.model.ts` — `OrgCategory`, `slugifyCategoryName`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/seed-org-categories.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). It performs write operations: `OrgCategory` (create).
- Command-line flags referenced: `--apply`.
