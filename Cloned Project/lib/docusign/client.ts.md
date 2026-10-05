# `lib/docusign/client.ts`

> The shared HTTP layer for the Docusign (Garage e-signature) feature: base URLs, a fetch wrapper with timeouts and 401 detection, query-string and URL builders, browser-side SHA-256 hashing, and the PDF/signature upload helper.

**Kind:** frontend library · **Lines:** 165

## Purpose
Docusign in this app talks to a **separate e-signature service** (default `https://docusign.garage.app/docusign/v1/`), not to the Express backend in `server/`. `internal-api.ts`, `external-api.ts` and `shared-api.ts` all build on this module; it is deliberately flow-agnostic and knows nothing about internal `documents/` vs external `esign-documents/`. It exists as a Docusign-scoped copy of `lib/api.ts`'s `api()` so the rest of the app keeps its behaviour while Docusign gets timeouts and reliable session-expiry handling. `public-api.ts` reuses only `DOCUSIGN_URL`.

## How it works
- **`DocusignAuthExpiredError`.** Thrown instead of a generic error whenever a response is 401, carrying `status = 401` (same field shape as other `api()` failures) and a default "Your session has expired. Please sign in again." message, so the UI can prompt re-login rather than show "Server error (401)".
- **Timeouts.** `timeoutSignal(ms)` returns an `AbortController` signal plus a `cancel()` that clears the timer. `DEFAULT_TIMEOUT_MS` is 30 s; `UPLOAD_TIMEOUT_MS` is 120 s for large PDFs and evidence-package downloads. Previously a stalled upload hung forever.
- **`api<T>(path, opts?, token?, timeoutMs?)`.**
  - Auth: explicit `token`, else `getToken()` (the `garage_tok` localStorage value) as `Authorization: Bearer`.
  - Sets `Content-Type: application/json` unless the body is `FormData`. Always `cache: "no-store"`. A caller-supplied `opts.signal` overrides the timeout signal.
  - Network errors: `AbortError` -> "The request timed out..."; anything else is logged with a `[DocuSign API]` prefix and rethrown as "Failed to connect to the DocuSign service...".
  - 401 -> `DocusignAuthExpiredError`, checked on the raw status before body parsing.
  - Other non-2xx: parses the body as JSON if possible; message is `error || message || "Server error (<status>)"`. The thrown `Error` gets `status`, plus `errors` (array of per-field validation problems, e.g. from `PUT branding`) and `documentId` (which bundle member failed, e.g. `POST .../bundle/:id/send`) when present. Callers can distinguish 403/404 from transient failures via `err.status`.
  - Success: returns `res.json()`.
  - `path` is used as-is, so callers pass a full URL built by `url()`.
- **URL helpers.** `url(path)` joins `DOCUSIGN_URL` (ensuring one trailing slash) with `path` minus leading slashes. `withQuery(path, params)` appends `k=v` pairs with URI-encoded values, skipping `undefined` and `""`.
- **`sha256Hex(file)`.** Hashes a Blob with Web Crypto in the browser and returns lowercase hex, or `null` if `crypto.subtle` is unavailable (old browser / insecure origin) or hashing fails. Callers send this as `originalFileHash` before uploading so the server can later prove the signed file is the one uploaded; with `null`, the backend fingerprints the file at completion instead.
- **`uploadDocusignFile(file, filename = "file", folder = "docusign")`.** Posts multipart `file` + `folder` to `${GARAGE_UPLOAD_URL}/api/s3upload/single` with the Bearer token and the 120 s timeout. Used for original PDFs and captured signature images; only the returned URL is ever sent to the Docusign service. Response URL/key are read from `json.url`/`json.key` or `json.data.url`/`json.data.key`. 401 -> `DocusignAuthExpiredError`; other failures throw `Upload failed (<status>): <body text>`.
- **`MAX_PDF_BYTES`** (25 MB) mirrors the Docusign backend's `MAX_REMOTE_FILE_BYTES` so oversized PDFs are rejected client-side before uploading.

## Exports
- `class DocusignAuthExpiredError extends Error` - 401 marker with `readonly status = 401`.
- `DEFAULT_TIMEOUT_MS` (30000), `UPLOAD_TIMEOUT_MS` (120000).
- `timeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void }`.
- `api<T>(path: string, opts?: RequestInit, token?: string, timeoutMs?: number): Promise<T>` - Docusign fetch wrapper.
- `DOCUSIGN_URL` - base URL of the Docusign service.
- `MAX_PDF_BYTES` - 25 MiB client-side PDF cap.
- `GARAGE_UPLOAD_URL` - base URL of the S3 upload service.
- `url(path: string): string` - absolute Docusign URL for a relative route.
- `withQuery(path, params: Record<string, string | number | undefined>): string` - append a query string.
- `sha256Hex(file: Blob): Promise<string | null>` - browser SHA-256.
- `uploadDocusignFile(file: File | Blob, filename?, folder?): Promise<{ url: string; key?: string }>` - upload to S3 via the upload service.

## Interfaces
- **External services:**
  - Docusign e-signature service at `DOCUSIGN_URL` (all JSON calls of the sibling modules).
  - Upload service `POST <GARAGE_UPLOAD_URL>/api/s3upload/single` (default `https://uatapi.garage.app`), which is not part of this repo's `server/`. The comment notes `test.garage.app` 404s on that route while `uatapi.garage.app` serves it.
- **Environment variables:**
  - `NEXT_PUBLIC_DOCUSIGN_URL` - Docusign service base URL (default `https://docusign.garage.app/docusign/v1/`).
  - `NEXT_PUBLIC_GARAGE_UPLOAD_URL` - upload service base URL (default `https://uatapi.garage.app`).
- **Browser storage / cookies:** reads the session token via `getToken()` (`localStorage["garage_tok"]`).

## Dependencies
- **Internal:** `lib/auth.ts` - `getToken()` for the Bearer header.
- **Packages:** none.

## Used by
`lib/docusign/internal-api.ts`, `lib/docusign/external-api.ts`, `lib/docusign/shared-api.ts`, `lib/docusign/public-api.ts` (only `DOCUSIGN_URL`), `components/dashboard/docusign/shared/PdfFilesPicker.tsx`, `components/dashboard/docusign/shared/SignatureCaptureModal.tsx`.

## Notes
- A stale comment in `uploadDocusignFile` refers to "createDocument / signDocument above"; those functions live in `internal-api.ts`.
- `NEXT_PUBLIC_API_URL` (the in-repo backend) is not used here at all; Docusign traffic never reaches `/backend/*`.
