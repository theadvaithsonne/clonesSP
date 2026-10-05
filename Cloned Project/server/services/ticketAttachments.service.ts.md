# `server/services/ticketAttachments.service.ts`

> S3 presign helpers for ticket attachments.

**Kind:** backend service · **Lines:** 142

<!-- docgen:auto -->

## Purpose
S3 presign helpers for ticket attachments. Mirrors the cabinet/S3
service's auth but uses a dedicated `tickets/` key prefix so
lifecycle policies can be tuned independently.

FE flow: client asks for a presigned PUT, uploads the file bytes
directly to S3, then sends only the resulting `key` in the
ticket / message payload. We never proxy the file bytes through
the API server.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PresignTicketUploadInput` | interface |  | 53 |
| `PresignTicketUploadOutput` | interface |  | 60 |
| `TicketUploadValidationError` | class | `extends Error` | 69 |
| `presignTicketUpload` | function | `async presignTicketUpload(input: PresignTicketUploadInput): Promise<PresignTicketUploadOutput>` | 104 |
| `presignTicketView` | function | `async presignTicketView(key: string): Promise<string>` — Re-sign a GET URL for an existing key, called on every list/detail read so the FE always has a fresh, non-expired URL. | 135 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.AWS_S3_REGION`, `env.AWS_ACCESS_KEY_ID`, `env.AWS_SECRET_ACCESS_KEY`, `env.AWS_S3_BUCKET`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `crypto`
  - `@aws-sdk/client-s3` — `GetObjectCommand`, `PutObjectCommand`, `S3Client`
  - `@aws-sdk/s3-request-presigner` — `getSignedUrl`

## Used by

- `server/routes/tickets.ts`
- `server/services/ticketHelpers.ts`
