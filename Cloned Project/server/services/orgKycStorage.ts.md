# `server/services/orgKycStorage.ts`

> S3 access for office KYC documents.

**Kind:** backend service · **Lines:** 236

<!-- docgen:auto -->

## Purpose
S3 access for office KYC documents.

These files (PAN cards, government IDs, address proofs) are identity
documents, so they live in their OWN bucket — `AWS_S3_KYC_BUCKET`, which has
"Block all public access" enabled. Nothing in here ever produces a permanent
URL: uploads go straight from the browser to S3 with a 5-minute presigned
PUT, and every read is a fresh 10-minute presigned GET minted per request.

Nothing else in the codebase may use this bucket, and this module never
touches `AWS_S3_BUCKET` — the general-purpose public bucket that uploads,
cabinet, recordings and ticket attachments all still use, unchanged.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `KycUploadValidationError` | class | `extends Error` | 72 |
| `isKycStorageConfigured` | function | `isKycStorageConfigured(): boolean` | 96 |
| `PresignKycUploadInput` | interface |  | 100 |
| `PresignKycUploadOutput` | interface |  | 107 |
| `presignKycUpload` | function | `async presignKycUpload(input: PresignKycUploadInput): Promise<PresignKycUploadOutput>` | 114 |
| `presignKycView` | function | `async presignKycView(s3Key: string, filename?: string): Promise<string>` — Fresh view URL for one stored document. | 155 |
| `KYC_VIEW_URL_TTL_SECONDS` | const | `= GET_TTL_SECONDS` | 172 |
| `ensureKycCors` | function | `async ensureKycCors(): Promise<void>` — A brand-new S3 bucket has NO CORS configuration, and without one the browser refuses the presigned PUT before it ever reaches S3 — the upload fails with an opaque network error even though the URL and credentials are perfectly good. | 185 |
| `deleteKycObject` | function | `async deleteKycObject(s3Key: string): Promise<void>` — Best-effort delete — used when a founder replaces or removes a document. | 227 |

## Interfaces

- **Environment via `server/config/env.ts`:** `env.AWS_S3_REGION`, `env.AWS_ACCESS_KEY_ID`, `env.AWS_SECRET_ACCESS_KEY`, `env.AWS_S3_KYC_BUCKET`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
- **Packages:**
  - `crypto`
  - `@aws-sdk/client-s3` — `DeleteObjectCommand`, `GetBucketCorsCommand`, `GetObjectCommand`, `PutBucketCorsCommand`, `PutObjectCommand`, `S3Client`
  - `@aws-sdk/s3-request-presigner` — `getSignedUrl`

## Used by

- `server/index.ts`
- `server/routes/garageAdminOrgKyc.ts`
- `server/routes/orgKyc.ts`
- `server/services/orgKyc.service.ts`
