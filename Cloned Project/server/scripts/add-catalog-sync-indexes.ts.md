# `server/scripts/add-catalog-sync-indexes.ts`

> One-time migration: add compound (status|isActive, updatedAt, _id) indexes to each of the 7 sellable + office collections so the new `/internal/catalog/items` cursor pagination is index-supported.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 105

<!-- docgen:auto -->

## Purpose
One-time migration: add compound (status|isActive, updatedAt, _id) indexes
to each of the 7 sellable + office collections so the new
`/internal/catalog/items` cursor pagination is index-supported.

Run once per environment:
    npx ts-node src/scripts/add-catalog-sync-indexes.ts

Safe to re-run — `createIndex` is idempotent.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/product.model.ts` — `Product`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/organization.model.ts` — `Organization`
- **Packages:**
  - `mongoose`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/add-catalog-sync-indexes.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
