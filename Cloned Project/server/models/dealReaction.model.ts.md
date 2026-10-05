# `server/models/dealReaction.model.ts`

> Mongoose model for one user's reaction (like or emoji) on a Garage Connect "deal".

**Kind:** Mongoose model · **Lines:** 29

## Purpose
Deals in the Garage Connect Deals tab are not stored rows. `server/services/deals.ts` projects them on the fly from the distribution collections, giving each one a synthetic id such as `up_<id>` or `cp_<id>`. This collection stores reactions against that synthetic string id, so a single reactions table serves both earning engines without a foreign key.

## How it works
- Fields: `dealId` (string, indexed), `userId` (ObjectId ref `User`, indexed), `type` (string, default `"like"`, max 32 chars and deliberately open-ended so the client can add new emoji without a migration). `timestamps: true` adds `createdAt`/`updatedAt`.
- A unique compound index on `{ dealId, userId }` enforces one reaction per user per deal. Reacting again replaces `type` (the route uses an upsert), and removing a reaction deletes the row instead of storing a "none" value. As a result `countDocuments({ dealId })` is the reaction total.
- The model is registered with the `models.DealReaction || model(...)` guard, so re-importing it (for example under hot reload) does not throw `OverwriteModelError`.

## Exports
- `DealReaction` - the Mongoose model (default pluralised collection `dealreactions`).

## Interfaces
- **Database:** `DealReaction` (collection `dealreactions`) - written by the reaction routes, read for counts and reactor lists.

## Dependencies
- **Packages:** `mongoose` - schema and model.

## Used by
- `server/routes/deals.ts` (mounted at `/deals`, browser `/backend/deals`): `PUT /backend/deals/:dealId/reaction` upserts with `updateOne`, `DELETE /backend/deals/:dealId/reaction` deletes, and `GET /backend/deals/:dealId/reactions` lists reactors. Each returns the fresh `countDocuments` total.
- `server/services/deals.ts` - aggregates reaction counts and finds the viewer's own reactions when building the deal feed.

## Notes
- Because `dealId` is a synthetic string, nothing stops reactions from outliving the deal they referred to. Orphaned rows are harmless but are never cleaned up.
