# `server/models/cabinet.model.ts`

> Defines the six Mongoose models behind the "Cabinet" file-storage feature: personal, floor and organisation cabinets (folders) and the S3-backed files inside each.

**Kind:** Mongoose model · **Lines:** 521

## Purpose
"Cabinet" is Garage's document store. Files live in AWS S3; MongoDB holds the folder tree and file metadata. Three scopes exist, each with its own cabinet model and file model:
- **User** - a member's private cabinets within an org (including a default "My Files" cabinet).
- **Floor** - one shared cabinet per floor of the virtual office.
- **Organisation** - cabinets shared by every member of the org.

The scopes are separate collections rather than one model with a discriminator, so controllers pick the model by scope.

## How it works

### Cabinet schemas (folders)
All three share `name`, `description`, `owner` (`User`, the creator), `organization` (`Organization`), `parentCabinet` (self-reference, default `null`), a required string `path`, `isRoot`, and free-form `permissions` and `metadata` (`Mixed`, default `{}`). Differences:
- `UserCabinetSchema` (L4-L52): `isRoot` defaults `false`; adds `isDefault` (true for the default "My Files" cabinet).
- `FloorCabinetSchema` (L55-L104): adds required `floorId` (`Floor`); `isRoot` defaults `true` ("floor cabinets are always root level").
- `OrganizationCabinetSchema` (L294-L338): `isRoot` defaults `true`.

### File schemas
`UserFileSchema` (L107-L195), `FloorFileSchema` (L198-L291) and `OrganizationFileSchema` (L341-L453) share:
- Names: `name`, `originalName` (both required), `description`.
- Ownership: `owner`, `organization`, and `cabinet` (ref to the matching cabinet model); floor files also carry `floorId`.
- Storage: `s3Key`, `s3Bucket`, `s3Region`, `mimeType`, `size` (all required), `extension`, `path`.
- `isPublic` (default `false`), `permissions`, `tags: [String]`, `metadata`.
- `status`: `uploading` (default), `uploaded`, `processing`, `ready`, `error`.
- Versioning: `version` (default 1) and `parentFile` (self-reference to the previous version).

**Organisation files only** add a `sharing` sub-object (L404-L427):
- `access`: `"office"` (default, only org members; a visitor is taken through sign-in and joined to the office before the file opens) or `"public"` (anyone with the link).
- `updatedAt`, `updatedBy` record who last changed it.
The default of `"office"` means files created before this field existed, or by a client that never sets it, stay private.

### Indexes (L455-L503)
- User cabinets: `{owner, organization}`, `{path, owner}`, `{parentCabinet}`, `{isDefault, owner, organization}`, plus a **unique partial** index `{owner, organization, isDefault}` where `isDefault: true`, so each user has at most one default cabinet per org.
- Floor cabinets: `{floorId, organization}` (declared twice, once plain and once **unique**, so one cabinet per floor per org), `{parentCabinet}`, `{organization}`.
- Files: lookups by owner/org, `cabinet`, `path`, `s3Key`, `mimeType`, `tags`; floor files also by `floorId`.
- Org cabinets: `{organization}`, `{parentCabinet}`, `{path}`.

### Collections
Mongoose default names: `usercabinets`, `floorcabinets`, `organizationcabinets`, `userfiles`, `floorfiles`, `organizationfiles`.

## Exports
- `UserCabinet` - model `"UserCabinet"`.
- `FloorCabinet` - model `"FloorCabinet"`.
- `OrganizationCabinet` - model `"OrganizationCabinet"`.
- `UserFile` - model `"UserFile"`.
- `FloorFile` - model `"FloorFile"`.
- `OrganizationFile` - model `"OrganizationFile"`.
- `Cabinet` - legacy alias of `UserCabinet` (backward compatibility).
- `File` - legacy alias of `UserFile`.

## Interfaces
- **Database:** all six collections above. Written by `server/controllers/cabinet.controller.ts` (the `/cabinet` router, browser `/backend/cabinet/...`) and `server/utils/cabinetStorage.ts`; read for share links (`server/controllers/shareableLink.controller.ts`, `server/routes/public.ts`); written by recording pipelines that save recordings into cabinets (`server/routes/livekitRecording.ts`, `server/routes/dailyWebhook.ts`, `server/services/webinarRecording.ts`, webinar and evergreen routes); cleaned up by `server/services/memberCleanup.service.ts`.
- **External services:** the binary content lives in AWS S3 (bucket/region/key stored per file); this file does not talk to S3 itself.

## Dependencies
- **Packages:** `mongoose` - `Schema`, `model`.

## Used by
`server/controllers/cabinet.controller.ts`, `server/controllers/collaborativeDocument.controller.ts`, `server/controllers/shareableLink.controller.ts`, `server/routes/dailyWebhook.ts`, `server/routes/evergreen.ts`, `server/routes/learnInit.ts`, `server/routes/livekitRecording.ts`, `server/routes/public.ts`, `server/routes/publicWebinar.ts`, `server/routes/webinarRoutes.ts`, `server/scripts/migrate-cabinets.ts`, `server/services/memberCleanup.service.ts`, `server/services/webinarRecording.ts`, `server/utils/cabinetStorage.ts`.

## Notes
- `FloorCabinetSchema` declares `{ floorId: 1, organization: 1 }` both as a plain index and as a unique index. MongoDB can only hold one index on the same key pattern with different options, so one of the two `createIndex` calls will error at sync time (Mongoose logs it). The unique one is the intended constraint.
- `sharing.access` exists only on organisation files. User and floor files rely on `isPublic`/`permissions`.
- The `Cabinet`/`File` aliases point at the *user* models; the registered model name is `"UserCabinet"`, so a `ref: "Cabinet"` elsewhere (see `collaborativeDocument.model.ts`) does not resolve to these models for `populate`.
- `File` shadows the global DOM/Node `File` name in importing modules.
