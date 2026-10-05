# `server/scripts/migrate-to-public-urls.ts`

> Migration script to convert presigned S3 URLs to public URLs Run with: npx ts-node src/scripts/migrate-to-public-urls.ts

**Kind:** backend one-off script (may write to the production DB) · **Lines:** 210

<!-- docgen:auto -->

## Purpose
Migration script to convert presigned S3 URLs to public URLs
Run with: npx ts-node src/scripts/migrate-to-public-urls.ts

This script:
1. Finds all messages with attachments
2. Extracts the S3 key from the old presigned URL (or uses existing fileKey)
3. Generates new public URLs that never expire

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Model `Message`

- **Collection:** `messages` (default pluralised name)

### Model `GroupMessage`

- **Collection:** `groupmessages` (default pluralised name)

## Exports

None — this file exports nothing.

## Interfaces

- **Environment via `server/config/env.ts`:** `env.AWS_S3_BUCKET`, `env.AWS_S3_REGION`, `env.MONGODB_URI`

## Dependencies

- **Internal:**
  - `server/config/env.ts` — `env`
  - `server/services/s3.ts` — `s3Service`
  - `server/models/message.model.ts` (side effect)
  - `server/models/groupMessage.model.ts` (side effect)
- **Packages:**
  - `mongoose`

## Used by

Entry: run by hand: `npx tsx server/scripts/migrate-to-public-urls.ts`.

## Notes

- ⚠ **Connects to `MONGODB_URI`** — in this project that is the **production database** (see `.env`). No write operations were detected, but check the code before running.
