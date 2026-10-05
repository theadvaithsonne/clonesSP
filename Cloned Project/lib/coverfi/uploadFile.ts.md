# `lib/coverfi/uploadFile.ts`

> Uploads one file to Garage's own `/backend/upload` endpoint (which stores it in S3) and returns its public URL. Coverfi forms and the auction dialog use it.

**Kind:** frontend library · **Lines:** 45

## Purpose
The Coverfi backend does not store files. Coverfi forms that take an image or document, such as an insurer logo, a product logo or document, or a brokerage branding image, upload through the main Garage backend and then save the returned URL in a Coverfi record. The same helper is also reused outside Coverfi by the auction start dialog.

## How it works
1. Reads the Garage token with `getToken()`. If there is none, it throws `Error("Not authenticated")` before making any request.
2. Builds a `FormData` with the single field `file`.
3. Sends `POST ${API_URL}/upload` with `Authorization: Bearer <token>` and `cache: "no-store"`. The browser sets the multipart `Content-Type` itself. This reaches `POST /backend/upload`, handled by `server/routes/upload.ts`, which is mounted at `/upload` in `server/app.ts`.
4. On a non-OK response, it tries to read `error` or `message` from a JSON body and throws `Upload failed (<status>)` or that message.
5. On success, it parses `{ url, key, fileName, fileSize, fileType }` and throws if `url` is missing.

On the server, the route runs `requireAuth`, accepts one multer `file` (under 100MB; images, video, audio, PDFs, Office documents, CSV and archives), stores it under a key derived from user, org and filename, and returns a public, non-expiring URL.

## Exports
- `interface UploadedFile` - `{ url: string; key?: string; fileName?: string; fileSize?: number; fileType?: string }`.
- `uploadFile(file: File): Promise<UploadedFile>` - uploads the file and resolves with the stored file's metadata.

## Interfaces
- **Backend endpoints called:** `POST /backend/upload` - authenticated multipart upload to S3 that returns the public URL.
- **Browser storage / cookies:** reads the `garage_tok` localStorage token through `lib/auth.ts`.

## Dependencies
- **Internal:** `lib/api.ts` - `API_URL` (the Garage backend base, `NEXT_PUBLIC_API_URL`); `lib/auth.ts` - `getToken()`.

## Used by
`components/coverfi/brokerage/ImageUpload.tsx`, `components/coverfi/products/ProductWizard.tsx` and `app/(dashboard)/auction/components/StartAuctionDialog.tsx`.

## Notes
- The upload goes to the Garage backend, not to `COVERFI_API_URL`.
- Uploaded files are public: anyone with the URL can fetch them.
