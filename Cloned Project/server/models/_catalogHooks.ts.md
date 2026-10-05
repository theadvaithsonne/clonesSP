# `server/models/_catalogHooks.ts`

> Shared Mongoose post-hook installer that turns every save/update/delete of a catalog model into a row on the `CatalogOutbox` collection.

**Kind:** Mongoose model helper · **Lines:** 80

## Purpose
Garage mirrors its sellable catalog (products, store products, courses, workshops, channels, services, call offerings, offices and job postings) to an external NetworkChain API. Rather than wrapping every service call, each catalog model calls `installCatalogHooks()` on its schema so that schema-level hooks catch writes regardless of which code path performed them. The file is not a model itself; it is the glue between the catalog schemas and the outbox service. The leading underscore marks it as a helper rather than a model file.

## How it works
`installCatalogHooks(schema, itemType, opts)` registers four Mongoose `post` hooks on the given schema:

| Hook | Trigger | Outbox op |
|---|---|---|
| `post("save")` | `new Model().save()`, `doc.save()` | `upsert` |
| `post("findOneAndUpdate")` | `findOneAndUpdate`, `findByIdAndUpdate` | `upsert` |
| `post("findOneAndDelete")` | `findOneAndDelete`, `findByIdAndDelete` | `delete` |
| `post("deleteOne", { document: true, query: false })` | `doc.deleteOne()` (document middleware only) | `delete` |

Each hook:
1. Skips if there is no document / `_id`, or if the optional gate `opts.isCatalogDoc(doc)` returns false (default gate always returns true).
2. Calls `enqueueCatalogChange(itemType, String(_id), op)` fire-and-forget (`void`), so the originating write never waits on or fails because of the outbox.
3. Wraps everything in `try/catch` and logs `[catalogHooks:<itemType>] ... hook error` instead of throwing.

`enqueueCatalogChange` (in `server/services/catalogOutbox.service.ts`) upserts one `pending` row per `(itemType, itemId)`, so a burst of edits collapses into one delivery, and on `delete` also writes a `CatalogTombstone`. The outbox is drained by `server/services/catalogOutbox.dispatcher.ts`, which is started from `server/index.ts`.

**Known gap (documented in code):** `updateOne` / `updateMany` / query-level `deleteMany` are not hooked, because Mongoose hands those hooks a result rather than documents, so the affected IDs are unknown. The comment says an hourly reconciler covers those writes.

## Exports
- `installCatalogHooks(schema: Schema, itemType: CatalogOutboxItemType, opts?: { isCatalogDoc?: (doc) => boolean }): void` - installs the outbox hooks on a schema. `itemType` is one of `product`, `storeproduct`, `course`, `workshop`, `channel`, `service`, `call`, `office`, `job`.

## Interfaces
- **Database:** `CatalogOutbox` - written (indirectly, via `enqueueCatalogChange`); `CatalogTombstone` - written on deletes (indirectly).
- **Background work:** none here; the dispatcher that consumes the outbox runs from `server/index.ts`.

## Dependencies
- **Internal:** `server/services/catalogOutbox.service.ts` - `enqueueCatalogChange`; `server/models/catalogOutbox.model.ts` - `CatalogOutboxItemType` type only.
- **Packages:** `mongoose` - `Schema` type for hook registration.

## Used by
Called at the bottom of each catalog schema file: `server/models/callOffering.model.ts` (`"call"`), `channel.model.ts` (`"channel"`), `course.model.ts` (`"course"`), `jobPosting.model.ts` (`"job"`), `organization.model.ts` (`"office"`, gated to `doc.parent !== true` so only non-parent office orgs are mirrored), `product.model.ts` (`"product"`), `service.model.ts` (`"service"`), `storeProduct.model.ts` (`"storeproduct"`), `workshop.model.ts` (`"workshop"`).

## Notes
- The header comment says "7 catalog models", but nine schemas install the hooks today.
- Hooks must be installed before `model()` is called on the schema, which is why each model file calls this just above its `model(...)` line.
- Because the gate runs on the post-write document, an organization that flips from non-parent to parent is simply no longer enqueued; no `delete` is sent for it by these hooks.
