# `server/models/affiliateLink.model.ts`

> Mongoose model `AffiliateLink`: a saved per-user referral URL for one sellable item, created on demand when a member generates a share link.

**Kind:** Mongoose model · **Lines:** 82

## Purpose
Backs the 1Network Links page, where members generate shareable affiliate links. Originally channel-only, it is now generalised to any `(itemType, itemId)` across the catalog. One row exists per `(userId, orgId, itemType, itemId)`; asking again returns the existing link instead of creating duplicates.

## How it works
- Fields: `userId` (required), `orgId` (required), `itemType` (`channel`, `product`, `office`, `course`, `service`, `workshop`, `call`; default `channel`), `itemId` (ObjectId), `channelId` (legacy; equals `itemId` for channel rows), `affiliateId` (affiliate code, required), `affiliateUrl` (required), `clickCount` (default 0), `lastClickedAt`, `isActive` (default true), timestamps.
- `clickCount` / `lastClickedAt` are bumped by the click-tracking pipeline in `routes/affiliate.ts` (`recordClick`, per the comment).
- Single-field indexes on `userId`, `orgId`, `itemType`, `itemId`, `channelId`, `affiliateId`.
- Unique compound index `{ userId, orgId, itemType, itemId }`.

## Exports
- `AffiliateLink` - Mongoose model.
- `interface IAffiliateLink` - document shape.
- `type AffiliateLinkItemType` - the allowed item types.

## Interfaces
- **Database:** `AffiliateLink` (collection `affiliatelinks`); refs `User`, `Organization`, `Channel`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
`server/routes/affiliate.ts`, mounted at `/affiliate` (browser `/backend/affiliate`) - `GET /affiliate/links`, `POST /affiliate/links`, `GET /affiliate/links/stats`, plus click recording.

## Notes
- The unique compound index **replaces** a legacy unique index on `{ userId, orgId, channelId }`. The comment says a migration script must backfill `itemId`/`itemType`, drop the old index and create the new one before this schema is deployed. The comment assumes autoIndex is on; `server/db/mongo.ts` actually disables autoIndex when `NODE_ENV=production` (unless `MONGO_AUTO_INDEX=true`), so in production the index must be created explicitly.
