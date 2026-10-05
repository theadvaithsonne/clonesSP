# `server/models/catalogOutbox.model.ts`

> Mongoose model for the durable outbox of catalog change events that are delivered as signed webhooks to the external NetworkChain API.

**Kind:** Mongoose model · **Lines:** 112

## Purpose
Garage's sellable items (products, store products, courses, workshops, channels, services, calls), offices and job postings are mirrored into NetworkChainApi, an external service. Rather than calling it inline on every edit, schema post-hooks (installed by `server/models/_catalogHooks.ts`) upsert a row here; a background dispatcher drains the rows and sends them. This is the classic transactional-outbox pattern: an edit is never lost because the webhook was down, and rapid edits collapse into one delivery.

## How it works
Fields (`ICatalogOutbox`, with `timestamps`):
- `itemType` - one of `product`, `storeproduct`, `course`, `workshop`, `channel`, `service`, `call`, `office`, `job`. The comment explains `job` is a referral-reward job posting: it has no price, the affiliate earns `reward.amount` USD on a successful hire, so the internal catalog reads different fields for it.
- `itemId` - string id of the item.
- `op` - `upsert` (default) or `delete`.
- `attemptCount` (default 0), `nextAttemptAt` (default now).
- `status` - `pending` (default), `in_flight`, `sent`, `dead`.
- `lastError`, `sentAt` (set when the row becomes `sent`).

Lifecycle, per the header and `server/services/catalogOutbox.service.ts` / `catalogOutbox.dispatcher.ts`:
1. A hook calls `enqueueCatalogChange`, which upserts the `(itemType, itemId)` row back to `pending` with `attemptCount: 0`. Repeated edits overwrite the same row.
2. The dispatcher polls every 2 seconds, signs the payload and POSTs it to NetworkChainApi.
3. Success sets `sent` + `sentAt`; failure schedules a retry on a backoff ladder (30 s up to 1 h). After 12 attempts the row becomes `dead`, and NetworkChain's hourly reconciler is relied on to pick the change up.

Indexes:
- `catalog_outbox_item_unique`: `{ itemType, itemId }` **unique** - one row per item, which is what makes the collapse work.
- `{ status, nextAttemptAt }` - the dispatcher's pull query.
- `catalog_outbox_sent_ttl`: TTL on `sentAt`, 24 hours, partial on `status: "sent"`. The comment ties 24 h to the receiver's idempotency window (Redis `SETNX ... EX 86400`).

Collection: Mongoose default, `catalogoutboxes`.

## Exports
- `CatalogOutbox` - the model.
- `type CatalogOutboxStatus` - `"pending" | "in_flight" | "sent" | "dead"`.
- `type CatalogOutboxOp` - `"upsert" | "delete"`.
- `type CatalogOutboxItemType` - the item-type union above.
- `interface ICatalogOutbox` - document type.

## Interfaces
- **Database:** `CatalogOutbox` (collection `catalogoutboxes`) - upserted by `server/services/catalogOutbox.service.ts` (called from `server/models/_catalogHooks.ts`), drained by `server/services/catalogOutbox.dispatcher.ts`, read by `server/routes/internal-catalog.ts`, and bulk-filled by `server/scripts/backfill-catalog-outbox.ts`.
- **External services:** NetworkChainApi receives the webhooks (sent by the dispatcher, not this file).
- **Background work:** the dispatcher is started from `server/index.ts` (`startCatalogDispatcher`) and polls this collection every 2 s.

## Dependencies
- **Packages:** `mongoose` - schema, model.

## Used by
`server/models/_catalogHooks.ts` (type import), `server/routes/internal-catalog.ts`, `server/scripts/backfill-catalog-outbox.ts`, `server/services/catalogOutbox.dispatcher.ts`, `server/services/catalogOutbox.service.ts`.

## Notes
- Because a `sent` row is reset to `pending` by the next edit, the unique index never blocks enqueueing.
- Deliveries are only as fresh as the last enqueue: `updateOne`/`updateMany` on catalog models do not fire the hooks (see `_catalogHooks.ts`), so such writes reach NetworkChain only through its reconciler.
- `CatalogTombstone` (the delete trail) does not include `job` in its enum, unlike this model.
