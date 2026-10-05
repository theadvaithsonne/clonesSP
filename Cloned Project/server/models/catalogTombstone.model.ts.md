# `server/models/catalogTombstone.model.ts`

> Mongoose model for a 30-day durable record of catalog item deletions, so lost delete webhooks can be replayed.

**Kind:** Mongoose model · **Lines:** 69

## Purpose
Catalog changes reach the external NetworkChain API through `CatalogOutbox`. An outbox row for a delete eventually disappears (24 h TTL once `sent`, or it goes `dead` after 12 retries). If a delete was lost during a webhook outage, the hourly NetworkChain reconciler needs a longer-lived trail to notice it; this collection keeps one for 30 days.

## How it works
Fields (`ICatalogTombstone`, with `timestamps`):
- `itemType` - one of `product`, `storeproduct`, `course`, `workshop`, `channel`, `service`, `call`, `office`.
- `itemId` - string id of the deleted item.
- `deletedAt` - default now.
- `reason` - optional free text.

Indexes:
- `catalog_tombstone_item_recent`: `{ itemType, itemId, deletedAt: -1 }` - latest deletion of an item.
- `catalog_tombstone_ttl_30d`: TTL on `deletedAt`, 30 days.

Rows are inserted by `recordCatalogTombstone` in `server/services/catalogOutbox.service.ts`, which `enqueueCatalogChange` calls whenever `op === "delete"`. Each deletion adds a new row (no uniqueness).

Collection: Mongoose default, `catalogtombstones`.

## Exports
- `CatalogTombstone` - the model.
- `type CatalogTombstoneItemType` - the item-type union.
- `interface ICatalogTombstone` - document type.

## Interfaces
- **Database:** `CatalogTombstone` (collection `catalogtombstones`) - insert-only from this codebase via `server/services/catalogOutbox.service.ts`; expired automatically by MongoDB after 30 days.

## Dependencies
- **Packages:** `mongoose` - schema, model.

## Used by
`server/services/catalogOutbox.service.ts`.

## Notes
- The enum omits `job`, although `CatalogOutboxItemType` and `JobPosting` (which installs catalog hooks with `"job"`) include it. Deleting a job posting therefore fails tombstone validation; `recordCatalogTombstone` catches and logs the error, so the delete itself and the outbox row are unaffected, but no tombstone is kept for jobs.
- No read path for this collection exists in this repo; it is presumably consumed by the reconciler through another route or directly.
