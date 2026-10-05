# `server/scripts/set-s3-cors.ts`

> One-time script to set CORS configuration on the S3 bucket.

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 80

<!-- docgen:auto -->

## Purpose
One-time script to set CORS configuration on the S3 bucket.
This is required for direct browser-to-S3 uploads (presigned PUT URLs).

Usage: npx ts-node src/scripts/set-s3-cors.ts

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

None — this file exports nothing.

## Interfaces

- **Environment variables (`process.env`):** `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`

## Dependencies

- **Internal:** none
- **Packages:**
  - `@aws-sdk/client-s3` — `S3Client`, `PutBucketCorsCommand`, `GetBucketCorsCommand`
  - `dotenv`

## Used by

Entry: run by hand: `npx tsx server/scripts/set-s3-cors.ts`.
