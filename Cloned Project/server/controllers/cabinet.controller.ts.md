# `server/controllers/cabinet.controller.ts`

> The Express controller behind the "Cabinet" file system: personal, floor and organization folders and files stored in S3, sharing personal items, utility clean-ups, and Gemini transcription of meeting recordings.

**Kind:** Express controller · **Lines:** 3897 · **Mounted at:** `/cabinet` (browser: `/backend/cabinet`)

## Purpose
The Cabinet is Garage's built-in document store. Each office has three kinds of storage, each kept in its own MongoDB collection pair:

- **personal** cabinets/files, owned by one user inside one organization (`UserCabinet`/`UserFile`)
- **floor** cabinets/files, shared by everyone on a floor (`FloorCabinet`/`FloorFile`)
- **organization** cabinets/files, shared by the whole office (`OrganizationCabinet`/`OrganizationFile`)

This file holds the request handlers for all of them. It is one class, `CabinetController`, made of static methods. `server/routes/cabinet.ts` wires each method to a route behind `requireAuth`. The file also exports the configured `multer` instance (`upload`) that those routes use to take multipart uploads. The file bodies live in S3 through `s3Service`, and MongoDB holds only the metadata: name, path, `s3Key`, size, MIME type, status and transcription.

## How it works

### Common conventions
- Every handler reads the caller from `req.user`, which `requireAuth` sets to `{ userId, orgId, ... }`. Nearly every handler also needs `?organizationId=` in the query string and returns `400` without it. The one exception is `transcribeOrganizationRecording`, which uses the token's `orgId` instead.
- Responses use the shape `{ success, message?, data? }`. Errors come back as `400` / `403` / `404` / `409` (name conflict) / `413` (storage quota) / `500`.
- Membership and role come from `user.organizations[]`: the entry whose `organization` equals `organizationId`, with its `role` (`founder`, `stakeholder`, ...) and `floorId`. The private helper `getUserFloorIdForOrg` (L53-L65) returns that membership's `floorId`.
- Folders are stored as a materialised `path` string (`/My Files`, `/organization/Recordings`, `/floor-<floorId>/Sub`). Name clashes are found by comparing paths, and names containing `/` or `\` are rejected on rename.
- S3 keys come from `s3Service.generateFileKey(userId, orgId, fileName)`, which produces `cabinet/<orgId>/<userId>/<timestamp>_<random>_<sanitised name>`. Every file record also stores `AWS_S3_BUCKET` and `AWS_S3_REGION`.
- **Legacy aliases:** `Cabinet` and `File` in `cabinet.model.ts` are plain aliases of `UserCabinet` and `UserFile`. Every "generic" handler that queries `Cabinet`/`File` therefore searches only the **personal** collections (see Notes).

### Multer configuration (L35-L47)
`multer.memoryStorage()` with a 2 GB `fileSize` limit, raised so long recordings fit, and a filter that accepts any type. The whole upload is held in memory as `req.file.buffer` before it goes to S3.

### Recording upload + transcription (L67-L223, L3739-L3893)
`uploadRecordingToOrganizationCabinet` is the last step of a workspace recording. `useRecording.ts` posts the `recording` field to it.
1. Any **member** of the org may call it. Founder rights are not required, and the comment explains why: a recording is not a cabinet edit gesture.
2. It finds or creates the root `OrganizationCabinet` (`isRoot: true`, path `/organization`) and then a `Recordings` sub-cabinet beneath it.
3. It runs `compressVideo`. That helper re-encodes video to VP9/Opus WebM with ffmpeg and keeps the result only if it is smaller. If ffmpeg is missing or fails, the original is kept.
4. The file name is `<meetingTitle | spaceId | "meeting">_<ISO timestamp>.<webm|mp4>`.
5. It calls `checkOrgUploadQuota` on the **compressed** size before the S3 put, so a rejected upload never leaves an orphan object. A full office gets `413` with `error: "STORAGE_LIMIT_REACHED"` and `storageLimit/totalUsed/remaining/planSlug`.
6. It uploads to S3 and saves an `OrganizationFile` with `status: "processing"`.
7. It responds `201` straight away, then starts `_runTranscription` without waiting for it. If that fails, the file status is set to `"error"`.

The private `_runTranscription(fileRecord)` (L3744-L3843) works like this:
- It loads `@google/generative-ai` and `@google/generative-ai/server` dynamically.
- It fetches the object from S3, writes it to `os.tmpdir()`, and uploads it to the Gemini File API. The temp file is deleted in a `finally`.
- It polls `getFile` once a second for up to 90 s, waiting for `state === "ACTIVE"`.
- It asks `gemini-2.5-flash-lite` for JSON `{ transcription, summary[], actionItems[] }`: a timestamped transcript with speaker labels, 3-5 summary bullets, and the action items.
- It strips code fences from the reply. If the JSON does not parse, the raw text is stored as `transcription`.
- It writes the result to `fileRecord.metadata.transcription`, adding `generatedAt` and `model`, and sets `status: "ready"`.

`transcribeOrganizationRecording` (L3850-L3893) is served at `POST /organization/files/:fileId/transcribe`. The doc comment says GET; the route says POST.
- It looks the file up by `_id` and the **token's** `orgId`, and returns `400` unless the MIME type is `video/*`.
- If a transcription is already stored, it returns it.
- If the status is `processing`, it returns `202`.
- Otherwise it sets `processing`, runs `_runTranscription` **synchronously** and returns the result. If that fails, it sets `error` and returns `500`.

### Personal cabinets (L225-L398, L606-L979)
- `createCabinet`: creates a `UserCabinet`. The path is `/<name>`, or the parent's path plus `/<name>`; the parent is looked up with `Cabinet.findById`. It returns `409` if the owner already has that path, and sets `isRoot` when there is no parent.
- `getCabinets`: lists the caller's cabinets under `parentCabinetId` (root level when it is absent), sorted by name. The default cabinet is left out.
- `getOrCreateDefaultPersonalCabinet`: finds or creates the caller's `isDefault` cabinet "My Files" (`/My Files`) and returns it along with its files.
- `getCabinetById` (L476-L604): returns `{ cabinet, subCabinets, files, floor }`. It contains founder/stakeholder checks for floor cabinets and a `Floor` lookup for breadcrumbs. Because `Cabinet` is `UserCabinet`, in practice it serves only the caller's own personal folders.
- `updateCabinet` / `renameCabinet`: change the name and/or description, recompute this cabinet's `path` from its parent, and return `409` on a clash. `renameCabinet` also trims the name and rejects slashes.
- `deleteCabinet` (L850-L979): deletes recursively. For each level it deletes every file's S3 object and DB record, recurses into sub-cabinets, then deletes the cabinet itself. A failure on one file is logged and skipped.

### Personal files (L981-L1427)
- `uploadFile`: if no `cabinetId` is given, it uses (or creates) "My Files". It checks the caller owns the target cabinet, uploads to S3 and saves a `UserFile` with `status: "uploaded"`. **No storage quota check** is made: the quota only counts `OrganizationFile`.
- `getFileDownloadUrl`: returns `{ downloadUrl, fileName, fileSize }`. `downloadUrl` is `s3Service.getPublicUrl(key)`, a permanent unsigned bucket URL, and `fileName` comes from `downloadNameFor` (`name` first, then `originalName`).
- `streamFileDownload`: proxies the bytes so the browser avoids S3 CORS. It sets `Content-Type`, `Content-Length` and an RFC 6266 `Content-Disposition` built by `buildContentDisposition`.
- `deleteFile`: deletes the S3 object, then the record.
- `renameFile`: trims the name, rejects slashes, returns `409` if the name exists in the same cabinet, then calls `applyFileRename`. That helper keeps `name`, `originalName`, `extension` and the tail of `path` in step, so downloads use the new name.
- `getFileInfo`: returns the file with its cabinet `name path` populated.
- `search` (L1364-L1427): `?q=&type=cabinet|file`. It matches cabinets on name/description (limit 10, default cabinet excluded) and files on name/originalName/description/tags (limit 20). Results are always limited to the caller's personal items.

### Floor cabinets (L1429-L1806, plus `getFloorCabinets` L400-L471)
Only founders and stakeholders get in. A stakeholder is limited to the floor in their own membership's `floorId`; a founder sees every floor.
- `getFloorCabinets`: lists `FloorCabinet`s for the org with `floorId` populated (`name level`). Stakeholders see only their own floor's.
- `getOrCreateFloorCabinet`: checks the `Floor` (`orgId` must match), then upserts the floor's root cabinet with `findOneAndUpdate(..., { $setOnInsert }, { upsert: true })`. The cabinet is named `"<floor> Cabinet"` with path `/floor-<floorId>`; the upsert stops duplicate roots from being created, and the model also has a unique index on `{floorId, organization}`. It returns the root, its sub-cabinets, files and floor info.
- `createFloorSubCabinet`: creates a folder under the root or under `parentCabinetId`, which must belong to the same floor. It returns `409` if the path already exists.
- `uploadFileToFloorCabinet`: requires `cabinetId`, which must belong to the floor. It uploads to S3 and saves a `FloorFile`. No quota check.

### Utility / maintenance endpoints (L1808-L2069)
All of these require only authentication plus an `organizationId`. **None checks role or membership.**
- `runMigration`: dynamically imports `server/scripts/migrate-cabinets.ts` and runs `migrateCabinetData()`. That function works across the **whole database** and ignores `organizationId`. It returns the counts of migrated cabinets and files.
- `cleanupDuplicateFloorCabinets`: groups cabinets that have a `floorId` by floor, keeps the oldest, re-points the others' files and sub-cabinets to it, and deletes the duplicates. It queries `Cabinet` (= `UserCabinet`), so it targets the personal collection.
- `cleanupOrphanedFiles`: loads every personal file in the org with `cabinet` populated, and deletes the S3 object and record of any whose cabinet no longer exists.
- `getAllUserFiles`: a debugging helper. It returns the caller's personal files plus `FloorFile`s they may see: all of them for founders, their own floor for stakeholders.

### Organization cabinet (L2071-L2964)
Any member can **read**. Only a `founder` can **create folders, upload, rename or delete**.
- `getOrCreateOrganizationCabinet`: finds the org's `OrganizationCabinet`, or creates the root "Organization Cabinet" at `/organization`. It returns `{ cabinet, subCabinets, files, storageDetails }`. `storageDetails` comes from `getOrgStorageDetails`: bytes used by photos, videos and documents, summed in Mongo, with the plan limit (2 GB Starter / 200 GB Pro). It logs heavily, including one line per file.
- `createOrganizationSubCabinet`: founder only. It creates a folder under the root or `parentCabinetId`, and returns `409` on a path clash.
- `uploadFileToOrganizationCabinet`: founder only. It requires `cabinetId` in the org, runs `checkOrgUploadQuota` (413 as above), uploads to S3 and saves an `OrganizationFile` with status `uploaded`.
- `getOrganizationCabinetById`: any member. It returns the folder's contents plus `storageDetails`.
- `deleteOrganizationFile`, `renameOrganizationFile`, `renameOrganizationCabinet`: founder only. Same validation as the personal versions.
- `getOrganizationFileDownloadUrl` / `streamOrganizationFileDownload`: any member. Same output as the personal versions.

### Personal sharing (L2966-L3737)
- `sharePersonalItem`: body `{ itemId, itemType: "file"|"cabinet", sharedWithUserId }`. Both users must be members of the org and the caller must own the item. Sharing the same item with the same user twice returns `409`. It creates a `SharedItem` that is **already accepted** (`status: "accepted"`) with `canView` and `canDownload` true and `canEdit` and `canDelete` false.
- `getSharedWithMe`: returns `pending`/`accepted` shares sent to the caller, with owner and recipient populated and the underlying `UserFile`/`UserCabinet` attached as `item`. It also adds every `CollaborativeDocument` in the org where the caller is a collaborator but not the creator, reshaped into the same format (`itemType: "document"`, can view/edit/download).
- `getSharedByMe`: shares the caller owns, with their items attached.
- `updateShare`: the owner may merge `permissions` and set `message`; the recipient may set `status` to `accepted` or `declined`, which stamps `respondedAt`.
- `revokeShare`: owner only. It sets `status: "revoked"`; the record is kept.
- `getSharedFileDownloadUrl` / `streamSharedFileDownload`: check for a live share and `permissions.canDownload`, write a `SharedAccessLog` entry (`action: "download"`, IP, User-Agent), then return the public URL or stream the bytes.
- `getSharedCabinetContents`: checks for a live cabinet share, logs `action: "view"`, and returns the cabinet's direct sub-cabinets and files (owner-scoped, and only when `canView` is set) plus `shareInfo`.
- `getUsersByEmail`: `?email=` is matched case-insensitively against `email` **or** `phone` within the org, excluding the caller, limit 10. The input goes through `escapeRegex` first; the comment records an earlier bug where an unescaped input could throw or match the whole org.
- `getItemShares`: the caller's shares of one item (`/share/:itemId/:itemType`).
- `getOrganizationMembers`: every other member of the org (`_id name email profilePicture`), sorted by name.

## Exports
- `CabinetController` (class) - all static handlers named above. Each has the form `(req: Request, res: Response) => Promise<void | Response>`. `getUserFloorIdForOrg` and `_runTranscription` are private.
- `upload` - the configured `multer` instance (memory storage, 2 GB limit).

## Interfaces
- **Endpoints served** (all behind `requireAuth`, browser prefix `/backend/cabinet`; most need `?organizationId=`):
  - `POST /files/upload` (field `file`) - `uploadFile`
  - `GET /files/:fileId/download`, `GET /files/:fileId/stream`, `GET /files/:fileId/info`, `PUT /files/:fileId/rename`, `DELETE /files/:fileId` - personal file operations
  - `POST /`, `GET /`, `GET /default`, `GET /floor`, `GET /search` - personal cabinet create, list, default, floor list, search
  - `GET /organization`, `POST /organization/sub-cabinet`, `POST /organization/files/upload` (field `file`), `POST /organization/recordings/upload` (field `recording`), `GET /organization/:id`, `POST /organization/files/:fileId/transcribe`, `GET /organization/files/:fileId/download`, `GET /organization/files/:fileId/stream`, `PUT /organization/files/:fileId/rename`, `DELETE /organization/files/:fileId`, `PUT /organization/:id/rename`
  - `GET /floor/:floorId`, `POST /floor/:floorId/sub-cabinet`, `POST /floor/:floorId/files/upload` (field `file`)
  - `GET /:id`, `PUT /:id`, `PUT /:id/rename`, `DELETE /:id` - generic (in practice personal) cabinets
  - `GET /files/all`, `POST /files/cleanup`, `POST /floor/cleanup-duplicates`, `POST /migrate` - utilities
  - `POST /share`, `GET /share/:itemId/:itemType`, `GET /shared/with-me`, `GET /shared/by-me`, `PUT /share/:shareId`, `DELETE /share/:shareId`, `GET /shared/files/:fileId/download`, `GET /shared/files/:fileId/stream`, `GET /shared/cabinets/:cabinetId`
  - `GET /users/search`, `GET /users/members`
  - The same router also serves collaborative-document and shareable-link routes, which are handled by other controllers.
- **Database:** `UserCabinet`, `UserFile`, `FloorCabinet`, `FloorFile`, `OrganizationCabinet`, `OrganizationFile` (all read/write/delete); `User` (read, for membership/role/floor and member search); `Floor` (read); `SharedItem` (read/write); `SharedAccessLog` (write); `CollaborativeDocument` (read). The models use Mongoose's default collection names (for example `usercabinets`, `organizationfiles`, `shareditems`).
- **External services:** AWS S3 (or the S3-compatible endpoint configured in `s3Service`) for file bytes; the Google Gemini API (File API plus the `gemini-2.5-flash-lite` model) for recording transcription; a local `ffmpeg` binary (through `compressVideo`).
- **Environment variables:** `AWS_S3_BUCKET`, `AWS_S3_REGION` - copied onto every file record. The S3 client itself is configured in `server/services/s3.ts`.
- **Background work:** each recording upload starts a fire-and-forget transcription. It writes a temp file under `os.tmpdir()` and polls Gemini for up to 90 s.

## Dependencies
- **Internal:**
  - `server/models/cabinet.model.ts` - the six cabinet/file models and the `Cabinet`/`File` aliases
  - `server/models/user.model.ts` - membership, role and floor lookups
  - `server/models/floor.model.ts` - floor name and level
  - `server/models/sharing.model.ts` - `SharedItem`, `SharedAccessLog`
  - `server/models/collaborativeDocument.model.ts` - documents in "shared with me"
  - `server/services/s3.ts` - upload, get, delete, public URL, key generation
  - `server/utils/cabinetStorage.ts` - plan quota and usage
  - `server/utils/fileNaming.ts` - download names, `Content-Disposition`, rename
  - `server/utils/videoCompression.ts` - ffmpeg compression
  - `server/utils/userSearchClauses.ts` - `escapeRegex`
  - `server/scripts/migrate-cabinets.ts` - lazy-loaded migration
- **Packages:**
  - `express` - types
  - `multer` - multipart uploads
  - `@google/generative-ai` - Gemini transcription, loaded dynamically
  - `fs`, `os`, `path` - temp files for transcription
  - `uuid` - imported as `uuidv4` but never used

## Used by
- `server/routes/cabinet.ts` - the only importer. It is mounted with `app.use("/cabinet", cabinetRoutes)` in `server/app.ts`, so the browser reaches it at `/backend/cabinet/*`, and BACKEND_HOSTS reach it at `/cabinet/*`.
- Frontend callers include:
  - `components/dashboard/CabinetPage.tsx`, `FounderCabinetPage.tsx`, `OrganizationCabinetPage.tsx` - the cabinet pages
  - `app/(dashboard)/workspace/hooks/useRecording.ts` - recording upload
  - `app/(dashboard)/deals/leads/[id]/page.tsx`

## Notes
- **Hardcoded secret:** `_runTranscription` hardcodes a Google Gemini API key as a string literal at **L3748** instead of reading it from the environment. Rotate it and move it to an env var.
- **Transcription likely always fails:** `s3Service.getFile()` returns a `Buffer`, and `_runTranscription` then loops `for await (const chunk of s3Object)` (L3755). Looping over a Buffer yields single byte **numbers**, and `Buffer.from(<number>)` throws a TypeError. In this code, background transcription therefore ends with `status: "error"`, and the manual transcribe endpoint returns `500`. Using the Buffer directly would fix it.
- **Floor branches in the generic handlers are effectively dead:** `Cabinet`/`File` are `UserCabinet`/`UserFile`, and personal cabinets have no `floorId` field. The floor checks in `getCabinetById`, `updateCabinet`, `renameCabinet` and `deleteCabinet` never trigger, and those routes cannot find a floor cabinet (they return 404). `cleanupDuplicateFloorCabinets` searches the personal collection for `floorId` and in practice finds nothing; floor roots are de-duplicated by the upsert and unique index instead.
- **Unguarded maintenance routes:** any logged-in user can call `POST /migrate`, which runs a database-wide migration, and `POST /files/cleanup`, which deletes S3 objects and records for orphaned personal files in any org whose id they pass.
- **Unescaped regex in `search`:** the regex is built from raw `q` (L1376). An input such as `(` causes a 500, and a crafted pattern can be slow. `getUsersByEmail` shows the fix (`escapeRegex`).
- **Download URLs are permanent public S3 URLs** (`getPublicUrl`, unsigned). Revoking a share does not stop someone who already has the URL; only the streaming routes enforce access on every request.
- **Org root lookup without `isRoot`:** `getOrCreateOrganizationCabinet` and `createOrganizationSubCabinet` use `OrganizationCabinet.findOne({ organization })` with no `isRoot` filter or sort. The recording path filters on `isRoot: true`. If natural order ever returns a sub-cabinet first (for example `Recordings`), that sub-cabinet would be treated as the root.
- Renaming a cabinet rewrites only that cabinet's own `path`. Paths of its descendant folders and files are not updated and go stale.
- Deleting a cabinet or file does not remove the `SharedItem` records that point at it. Shared-with-me lists then show `item: null`.
- `transcribeOrganizationRecording` uses the token's `orgId`, not `?organizationId`. If the caller is acting in a different office from their token's, the file returns 404.
- Personal and floor uploads skip the storage quota. Only organization uploads and recordings are checked.
- Personal cabinet creation and listing do not check that the caller belongs to `organizationId`.
- With memory storage, a 2 GB upload is held entirely in RAM, and `compressVideo` writes it to disk once more.
