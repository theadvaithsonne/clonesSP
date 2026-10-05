# `server/services/catalogOutbox.service.ts`

> Catalog outbox — write-side helpers.

**Kind:** backend service · **Lines:** 69

<!-- docgen:auto -->

## Purpose
Catalog outbox — write-side helpers.

Two surfaces:
 - `enqueueCatalogChange` — called from Mongoose post-hooks across the 7
   sellable / office models. Idempotently upserts a `pending` row keyed by
   `(itemType, itemId)` so rapid edits collapse into one delivery.
 - `recordCatalogTombstone` — called on delete events to keep a 30-day
   durable trail outliving the outbox row's TTL.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `enqueueCatalogChange` | function | `async enqueueCatalogChange(itemType: CatalogOutboxItemType, itemId: string, op: CatalogOutboxOp): Promise<void>` | 14 |
| `recordCatalogTombstone` | function | `async recordCatalogTombstone(itemType: CatalogOutboxItemType, itemId: string, reason?: string): Promise<void>` | 50 |

## Interfaces

- **Database (Mongoose models used):**
  - `CatalogOutbox` (server/models/catalogOutbox.model.ts) — **writes:** `updateOne`
  - `CatalogTombstone` (server/models/catalogTombstone.model.ts) — **writes:** `create`

## Dependencies

- **Internal:**
  - `server/models/catalogOutbox.model.ts` — `CatalogOutbox`, `CatalogOutboxItemType`, `CatalogOutboxOp`
  - `server/models/catalogTombstone.model.ts` — `CatalogTombstone`
- **Packages:** none

## Used by

- `server/models/_catalogHooks.ts`
- `server/routes/internal-catalog.ts`
- `server/scripts/backfill-catalog-outbox.ts`
