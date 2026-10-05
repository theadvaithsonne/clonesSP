# `server/models/drop.model.ts`

> Mongoose model for "Drops", short-form videos of up to 60 seconds in the style of Reels or Shorts, posted by organisation members.

**Kind:** Mongoose model · **Lines:** 116

## Purpose
Drops is the short-video feed inside an organisation. Any org member can upload a clip or link an external video. The feed uses cursor-based pagination for infinite scroll. This file defines the stored shape and the indexes that make the feed, "my drops", trending and "did I like this" queries cheap.

## How it works
Fields (`IDrop`):
- `caption` (trimmed, max 500, default `""`), `authorId` (ref `User`, required, indexed), `orgId` (ref `Organization`, required, indexed).
- Video source: `sourceType` is `"upload" | "link"` (required, default `"upload"`). For an upload, `videoS3Key` holds the S3 object key; for a link, `videoUrl` holds the YouTube, Vimeo or direct MP4 URL. The comment says exactly one should be set, but the schema does not enforce it.
- `thumbnailUrl` and `duration` (seconds, 0-60, enforced by `min`/`max`).
- Denormalised counters: `viewsCount`, `likesCount`, `sharesCount` (all `min: 0`).
- `likedBy`: an array of user ObjectIds with `select: false`. It backs the idempotent like toggle, because `likesCount` alone could not tell a repeated like from a new one (a page refresh used to let one user like twice). It is excluded from normal queries so it never inflates feed payloads or reveals who liked what.
- `isPublished` and `isActive` (both default `true`), plus timestamps.

Indexes:
- `feed_cursor_idx`: `{ orgId, isActive, isPublished, createdAt: -1, _id: -1 }`, the primary newest-first cursor seek.
- `{ authorId, createdAt: -1 }` for a user's own drops.
- `{ orgId, viewsCount: -1 }` for the trending sort.
- A multikey index on `{ likedBy }` for the per-page "which of these did I like" check and the like-toggle existence guard.

## Exports
- `IDrop` - document interface.
- `Drop` - the model (default collection `drops`). Registered without a `models` guard.

## Interfaces
- **Database:** `Drop` (collection `drops`).

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/routes/drops.ts` (mounted at `/drops`, browser `/backend/drops`): feed `GET /`, create `POST /`, `POST /:id/view`, `POST /:id/like`, `POST /:id/share`, `GET /:id`, `DELETE /:id`, the public `GET /public/:id`, and the upload helpers `POST /presigned-upload` and `GET /signed-url`.
- `server/routes/contentEngagement.ts` (mounted at `/content-engagement`) - lists a user's drops in an org for engagement stats.

## Notes
- Code that needs `likedBy` must request it explicitly with `.select("+likedBy")`.
