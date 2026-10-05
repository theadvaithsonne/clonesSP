# `lib/uploadthing.ts`

> Drop-in replacement for the UploadThing React helpers that sends every upload to this project's own S3 upload endpoints on the Express backend instead of the third-party UploadThing service.

**Kind:** frontend library · **Lines:** 125

## Purpose
The app originally used UploadThing (`useUploadThing`, `uploadFiles`, `UploadButton`, ...). Rather than rewrite every caller, this module keeps the same export names and return shapes but uploads to `POST /backend/upload` (authenticated) or `POST /backend/uploads/public` (no auth, for onboarding). The backend stores the files in AWS S3.

## How it works
- `API_BASE` is `NEXT_PUBLIC_API_URL`, with `http://localhost:4000` as the fallback.
- `uploadToBackendS3(file)` (internal) sends a multipart `FormData` with field `file` to `${API_BASE}/upload`. When `getToken()` returns a token it adds `Authorization: Bearer <garage_tok>`. Non-OK responses throw with the server's `error` message. It returns `{ url, key }`, where `key` falls back to `data.fileKey`. The backend route `server/routes/upload.ts` uses `requireAuth` and `multer.single("file")`.
- `useUploadThing(endpoint)` mirrors the UploadThing hook API. `startUpload(files)` uploads the files *sequentially* and returns `[{ url, key, name, size }]`. While it runs, `isUploading` is true. Errors are logged and re-thrown. The `endpoint` argument is ignored for routing: it only appears in the log message and the `useCallback` dependencies. `permittedFileInfo` is always `null`.
- `uploadFiles(endpoint, { files })` is the same upload loop without React state.
- `uploadToUploadThing(file, type)` is used for organisation icon and cover-photo uploads during onboarding, before the user has a token. It posts to `${API_BASE}/uploads/public` with no auth and returns `data.url`. It throws when the URL is missing or the response is not OK (message from `err.error`, then `err.hint`). The backend route (`server/routes/uploadsPublic.ts`) enforces its own MIME whitelist and size limits.
- `deleteFromUploadThing(fileKey)` only logs and deletes nothing.
- `UploadButton` and `UploadDropzone` are components that render `null`. They exist only so old imports keep compiling.

## Exports
- `useUploadThing(endpoint: string)` - returns `{ startUpload(files: File[]), isUploading, permittedFileInfo: null }`.
- `uploadFiles(endpoint: string, options: { files: File[] })` - returns `Promise<{ url, key, name, size }[]>`.
- `UploadButton`, `UploadDropzone` - no-op components that render `null`.
- `uploadToUploadThing(file: File, type: "icon" | "coverPhoto"): Promise<string>` - unauthenticated public upload that returns the URL.
- `deleteFromUploadThing(fileKey: string): Promise<void>` - no-op, logs only.

## Interfaces
- **Backend endpoints called:**
  - `POST /backend/upload` - `requireAuth`, multipart field `file`, returns `{ url, key | fileKey }`.
  - `POST /backend/uploads/public` - no auth, multipart field `file`, returns `{ url }`.
- **Environment variables:** `NEXT_PUBLIC_API_URL` - backend base URL.
- **Browser storage / cookies:** reads the token through `getToken()` (localStorage `garage_tok`).

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()`.
- **Packages:** `react` - `useState` and `useCallback` for the hook.

## Used by
`app/careers/[id]/VacancyDetailClient.tsx`, `components/dashboard/FeedPageRedesigned.tsx`, `components/dashboard/jobs/candidate/ApplyFlow.tsx`, `components/dashboard/jobs/founder/candidate/OfferDrawer.tsx`, `components/dashboard/jobs/founder/settings/CareersPageSection.tsx`, `components/deals/cms/PageBuilderShell.tsx`, `components/feed/CommentInput.tsx`, `components/feed/CreatePostModal.tsx`, `components/feed/InlinePostComposer.tsx`, `components/shared/ManageOrgPopover.tsx`, `utils/uploadthing.ts`.

## Notes
- Despite the name, nothing here talks to UploadThing anymore.
- `deleteFromUploadThing` deletes nothing, so files that callers think they removed stay in S3.
- `useUploadThing` calls `/upload` even when the user has no token. In that case the backend rejects the request with 401 and the hook throws.
