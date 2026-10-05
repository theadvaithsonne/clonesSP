# `lib/profilePictureUpload.ts`

> Uploads a profile picture to S3 through the backend's unauthenticated public upload route and returns the resulting public URL.

**Kind:** frontend library · **Lines:** 54

## Purpose
The Profile popover lets users change their avatar. This helper used to go through the authenticated `/profile/presigned-upload` endpoint. That broke when a user's 7-day JWT had expired: they got a 401 with no clear hint to log in again. The upload now goes through the public route that the onboarding org-logo flow also uses. The follow-up profile `PUT`, which carries the bearer token, is what links the URL to the user in MongoDB.

## How it works
`uploadProfilePictureToS3(file)`:
1. Checks the file on the client. It throws `"File size must be less than 5MB"` above 5 MB (`MAX_FILE_SIZE`, which matches the backend multer limit) and `"Only image files are allowed"` when `file.type` does not start with `image/`.
2. Sends the file as multipart field `file` to `POST ${API_URL}/uploads/public`, with no auth header.
3. On a non-2xx response it throws the server's `error` or `hint` field, or `"Upload failed"`.
4. Returns `data.url`, or throws `"Upload returned no URL"` if it is missing.

The backend (`server/routes/uploadsPublic.ts`, mounted at `/uploads/public` in `server/app.ts`) stores the object under `public-onboarding/YYYY-MM-DD/...` in S3 and checks the MIME type against its own allow-list.

## Exports
- `uploadProfilePictureToS3(file: File): Promise<string>` - validates and uploads the image, then returns its public S3 URL. Throws an `Error` with a user-friendly message.

## Interfaces
- **Backend endpoints called:** `POST /backend/uploads/public` - anonymous multipart upload that returns `{ url, ... }`.
- **External services:** AWS S3, indirectly through the backend.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL` (the `/backend` base).
- **Packages:** none

## Used by
- `components/shared/ProfilePopover.tsx` - Complete Profile / avatar change.

## Notes
- Trade-off: uploaded avatars have no user attribution in the S3 key. Images uploaded but never saved to a profile stay in `public-onboarding/` as orphans.
- Older avatars (UploadThing or earlier S3 paths) still work, because `User.profilePicture` is just a URL string.
- The public endpoint accepts anonymous uploads. Any abuse protection lives in the backend route, not here.
