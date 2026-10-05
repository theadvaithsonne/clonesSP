# `server/bat246/models/bat246LostMoneyGalleryImage.model.ts`

> Mongoose model for the photo carousel on the Lost Money site's home page. Each document is one image stored in S3.

**Kind:** BAT246 game module (backend) — Mongoose model · **Lines:** 19

## Purpose
The Lost Money home page shows a photo carousel next to the owner's opening message. Admins add, reorder and remove images only from the BAT246 admin back-office. This model stores each image's public URL and its S3 key, so the object can be deleted from S3 when the image is removed.

## How it works
Fields (`timestamps: true`):
- `url` (required): the public URL from `s3Service.getPublicUrl(key)`.
- `key` (required): the S3 object key.
- `order` (Number, default 0): display position in the carousel.

How `server/bat246/routes/bat246LostMoney.routes.ts` uses it:
- **Upload:** stores the file in S3, then creates the row with `order` equal to the current document count, so new images go last.
- **Reorder:** rewrites `order` to each id's index in the list it receives.
- **Delete:** tries to remove the S3 object (a failure is logged as a warning and does not stop the delete), then deletes the row.
- **Public listing:** sorts by `order`, then `createdAt`.

## Exports
- `Bat246LostMoneyGalleryImage` - Mongoose model registered as `"bat246LostMoneyGalleryImages"`.

## Interfaces
- **Database:** collection `bat246lostmoneygalleryimages`.
- **Endpoints using it** (mounted at `/bat246/lostmoney`):
  - `GET /backend/bat246/lostmoney/gallery`: public.
  - `POST /backend/bat246/lostmoney/gallery`: multipart upload, field `file`.
  - `POST /backend/bat246/lostmoney/gallery/reorder`: body `orderedIds`.
  - `POST /backend/bat246/lostmoney/gallery/:id/delete`.
  - All except the public `GET` require `requireAuth` + `requireAlanK`.
- **External services:** AWS S3, through the route's `s3Service`.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/bat246/routes/bat246LostMoney.routes.ts` (only importer).
