# `server/models/storeDrop.model.ts`

> Read-only Mongoose mirror of the `storedrops` collection owned by the separate garage-store backend (the NetworkChain "Drop" short-video feature).

**Kind:** Mongoose model · **Lines:** 37

## Purpose
This backend and the garage-store backend share one MongoDB database, so this backend reads drop documents directly instead of making a cross-service HTTP call. Only the fields needed at invoice fulfilment are declared. They are used to confirm which creator a drop-driven sale belongs to (`authorId`) and to check that the drop is valid (`status`, `productId`).

## How it works
- The schema declares `authorId`, `authorName`, `productId` and `status`. It sets `strict: false`, so other fields owned by the store backend pass through untouched.
- The collection name is pinned to `storedrops` to match the owning service exactly.
- `IStoreDrop.status` is typed as `"published" | "removed"`, but the schema stores any string.

## Exports
- `StoreDrop` - Mongoose model `"StoreDrop"` bound to collection `storedrops`.
- `IStoreDrop` - interface `{ _id, authorId, authorName?, productId, status }`.

## Interfaces
- **Database:** `StoreDrop` (collection `storedrops`), read only.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/invoice.ts`. The model is loaded with a dynamic `import()`. During distribution of a line item that has `dropProduct` and a valid `dropId`, the service runs `StoreDrop.findById(li.dropId).select("authorId authorName productId status").lean()`. It accepts the drop only when `status === "published"` and `productId` matches the line's `itemId`. It credits the drop creator split only when the author exists and is not the buyer. Otherwise the line is distributed normally.

## Notes
- **Never write through this model.** The store backend is the only owner of the collection.
- The source comment warns that the auth backend's own `drops` collection is an unrelated video feature. Do not point this model at `drops`.
