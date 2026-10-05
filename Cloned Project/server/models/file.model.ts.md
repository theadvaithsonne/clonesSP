# `server/models/file.model.ts`

> Mongoose model for a generic cabinet file stored in S3, with path, metadata, status and versioning fields. Nothing in the codebase imports it.

**Kind:** Mongoose model · **Lines:** 109

## Purpose
This looks like an early, generic design for the Cabinet (file storage) feature: one `File` collection covering every cabinet. The live Cabinet code uses the per-scope models in `server/models/cabinet.model.ts` (`UserFile`, `FloorFile`, `OrganizationFile` and their cabinets) instead. No importers were found, and a search finds no reference to this model other than its own `parentFile` self-reference.

## How it works
Fields:
- `name` and `originalName` (required, trimmed), `description`.
- Ownership: `owner` (ref `User`), `organization` (ref `Organization`), `cabinet` (ref `Cabinet`), all required.
- S3 location: `s3Key`, `s3Bucket`, `s3Region` (required).
- Metadata: `mimeType` and `size` in bytes (required), `extension`, `path` within the cabinet (required, for example `/Documents/Projects/file.pdf`).
- Access: `isPublic` (default false) and `permissions` (Mixed, default `{}`).
- `tags[]` and `metadata` (Mixed).
- `status`: `uploading | uploaded | processing | ready | error` (default `uploading`).
- Versioning placeholders: `version` (default 1) and `parentFile` (ref `File`, default null).
- Timestamps are on.

Indexes: `{ owner, organization }`, `{ cabinet }`, `{ path, owner }`, `{ s3Key }`, `{ mimeType }`, `{ tags }`.

## Exports
- `File` - the model (default collection `files`). It has no TypeScript interface, so documents are loosely typed.

## Interfaces
- **Database:** `File` (collection `files`). No code reads or writes it.

## Dependencies
- **Packages:** `mongoose`.

## Used by
Appears unused: no file imports it. It is only registered with Mongoose if some module loads it, for example through a glob import.

## Notes
- `cabinet` references a model named `Cabinet`, but `cabinet.model.ts` registers `UserCabinet`, `FloorCabinet` and `OrganizationCabinet`, so populating `cabinet` would fail.
- The exported name `File` shadows the global `File` Web API type in any module that imports it.
- This is a candidate for removal once it is confirmed nothing outside the repo depends on the `files` collection.
