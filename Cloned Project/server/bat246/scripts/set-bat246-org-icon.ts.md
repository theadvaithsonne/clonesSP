# `server/bat246/scripts/set-bat246-org-icon.ts`

> One-off script that uploads a local badge image to S3 and sets it as the BAT246 organisation's `icon` and `store.icon`.

**Kind:** backend one-off script (uploads to S3, writes to the production DB) · **Lines:** 68

## Purpose
Replaces the BAT246 office's logo with a new "TLS Revolution / BAT 246" circular badge supplied as a local file. The header explains why it uses S3 rather than the app's UploadThing helper: the UploadThing REST route that helper calls had started returning HTTP 400. The image is stored under the same `public-onboarding/YYYY-MM-DD/...` key prefix that `server/routes/uploadsPublic.ts` uses for permanently public assets; the org's icon fields are plain URL strings, so a different host is fine.

## How it works
1. `dotenv.config()`; requires `MONGODB_URI` (throws if unset). **Production database in this project.**
2. Dynamically imports `s3Service` from `server/services/s3.ts` and the `Organization` model.
3. Reads the image from `LOCAL_FILE_PATH`, a hard-coded absolute path on the original developer's Windows desktop (L22-L23).
4. Uploads it with `s3Service.uploadFile(key, buffer, "image/jpeg", { uploadedVia: "set-bat246-org-icon-script", uploadedAt })`, where the key is `public-onboarding/<today>/<timestamp>_bat246-tls-revolution-badge.jpeg`, then builds the URL with `s3Service.getPublicUrl(key)`.
5. Connects to Mongo (after the upload), logs the org's current `icon` / `store.icon`, sets both to the new URL with `Organization.updateOne`, and logs the result. `BAT246_ORG_ID` is hard-coded at L21.
6. Disconnects; errors exit with code 1.

## Exports
None.

## Interfaces
- **Database:** `Organization` (collection `organizations`) - read and update `icon` and `store.icon` of one org.
- **External services:** AWS S3 (or an S3-compatible endpoint) via `s3Service` - one public object upload.
- **Environment variables:** `MONGODB_URI` - connection string (production); the S3 settings that `server/services/s3.ts` reads through `server/config/env` (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_S3_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE`).

## Dependencies
- **Internal:** `server/services/s3.ts` - upload and public URL; `server/models/organization.model.ts` - org update.
- **Packages:** `mongoose`, `dotenv`, `fs` (reads the local image).

## Used by
Not imported anywhere. Run by hand, e.g. `npx tsx server/bat246/scripts/set-bat246-org-icon.ts`.

## Notes
- The local file path only exists on one machine; on any other machine `fs.readFileSync` throws before anything is uploaded.
- Each run uploads a new S3 object (the key includes `Date.now()`); earlier uploads are never deleted.
- The upload happens before the Mongo connection; if the DB step fails, the S3 object is left orphaned.
