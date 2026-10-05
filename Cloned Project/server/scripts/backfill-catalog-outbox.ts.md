# `server/scripts/backfill-catalog-outbox.ts`

> Catalog → Qdrant backfill via the existing outbox pipeline.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 169

<!-- docgen:auto -->

## Purpose
Catalog → Qdrant backfill via the existing outbox pipeline.

Walks every sellable / office collection and enqueues an `upsert`
row in CatalogOutbox for each existing document. The dispatcher
(already running on the roam-backend process) drains these rows
and delivers webhooks to NetworkChainApi, which embeds + upserts
into Qdrant `catalog_items`.

Use this when:
 - Standing up a fresh Qdrant instance (dev / staging) and need
   every existing catalog item indexed.
 - Repointing roam-backend's MONGODB_URI at a different DB
   snapshot — the dispatcher only fires on changes, so existing
   rows need an explicit kick to re-index.
 - Suspecting Qdrant drift vs Mongo and wanting a forced re-emit.
 […]

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `run` | function | `async run(): Promise<void>` | 168 |

## Interfaces

- **Environment variables (`process.env`):** `BACKFILL_BATCH_SIZE`, `BACKFILL_TYPES`, `BACKFILL_LIMIT`
- **Environment via `server/config/env.ts`:** `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/models/jobPosting.model.ts` — `JobPosting`
  - `server/config/env.ts` — `env`
  - `server/models/product.model.ts` — `Product`
  - `server/models/course.model.ts` — `Course`
  - `server/models/workshop.model.ts` — `Workshop`
  - `server/models/channel.model.ts` — `Channel`
  - `server/models/service.model.ts` — `Service`
  - `server/models/callOffering.model.ts` — `CallOffering`
  - `server/models/organization.model.ts` — `Organization`
  - `server/services/catalogOutbox.service.ts` — `enqueueCatalogChange`
  - `server/models/catalogOutbox.model.ts` — `CatalogOutboxItemType`, `(types only)`
- **Packages:**
  - `dotenv`
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/backfill-catalog-outbox.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
