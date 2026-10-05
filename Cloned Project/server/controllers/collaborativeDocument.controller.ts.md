# `server/controllers/collaborativeDocument.controller.ts`

> Express controller that backs Cabinet's collaborative Word/Excel/PowerPoint documents, which are edited in an ONLYOFFICE Document Server and stored in S3.

**Kind:** Express controller · **Lines:** 968 · **Mounted at:** `/cabinet` (browser: `/backend/cabinet`)

## Purpose
Cabinet (the platform's file area) lets users create office documents and edit them together in the browser. Editing is done by an external ONLYOFFICE Document Server. This controller does four jobs: it creates the files (blank or copied from an uploaded Cabinet file) and their database records, builds the signed ONLYOFFICE editor config the frontend needs, serves the raw file to ONLYOFFICE, and takes ONLYOFFICE's save callbacks to write new versions back to S3. All handlers are static methods on one class and are wired up in `server/routes/cabinet.ts`.

## How it works

### Module-level helpers (L15-L167)
- `ONLYOFFICE_JWT_SECRET` (L16) comes from `process.env.ONLYOFFICE_JWT_SECRET`. If it is unset the code falls back to a hardcoded default string (see Notes).
- `createBlankDocx()`, `createBlankXlsx()` and `createBlankPptx()` build real empty OOXML files with `docx` (one empty paragraph), `exceljs` (one sheet named "Sheet1") and `pptxgenjs` (one blank slide).
- `_oldCreateBlankPptx()` (L47-L125) holds a hardcoded base64 ZIP. Nothing calls it. It is dead code kept from an earlier version.
- `generateDocumentKey()` returns `doc_<base36 timestamp>_<16 hex random chars>`. This becomes the S3 file name and the stored `fileKey`.
- `generateOnlyOfficeToken(payload)` signs a payload with the ONLYOFFICE secret. The token expires after 1 hour.
- `getFileExtension(type)` / `getMimeType(type)` map `DocumentType` (`word` / `cell` / `slide`) to `docx`/`xlsx`/`pptx` and their OOXML MIME types. Anything else falls back to Word.

### Creating documents
- **`createDocument`** (L173-L261): needs `?organizationId=` plus a body of `{ title, type, cabinetId? }`, and `type` must be `word`, `cell` or `slide`. It builds a blank template and uploads it to S3 at `documents/<organizationId>/<userId>/<documentKey>.<ext>`, attaching metadata (`documentKey`, `type`, `createdBy`). It then saves a `CollaborativeDocument` with `version: 1`, an empty `collaborators` list, the size and the MIME type. It populates `createdBy` (`name email profilePicture`) and returns 201.
- **`createFromFile`** (L266-L358): body `{ fileId, title, type }`. It loads `UserFile` with a dynamic import of `../models/cabinet.model`, to avoid a circular import. The lookup is scoped to the organisation. It reads the file's bytes from S3 by `s3Key` and copies them to a new `documents/...` key, adding `sourceFileId` to the metadata. The new record takes the source file's cabinet. The handler does not check that the source file's real format matches `type`: the copied bytes are simply labelled with the MIME type for `type`.

### Reading and listing
- **`getDocuments`** (L363-L395): returns the organisation's documents where the caller is `createdBy` or appears in `collaborators`, newest `updatedAt` first, with both user refs populated.
- **`getDocumentById`** (L400-L504): uses the same access filter. It builds:
  - `fileUrl = <BACKEND_URL>/cabinet/documents/<id>/file`. ONLYOFFICE fetches the file through this backend proxy rather than straight from S3. The comment says this works better with Docker.
  - `callbackUrl = <BACKEND_URL>/cabinet/documents/<id>/callback?organizationId=...`
  - A session key `<fileKey>_v<version>_t<unix seconds>`. ONLYOFFICE caches by key, so each editor open gets a fresh key.
  - `editorConfig`: full permissions (edit, download, print, comment, review, chat), mode `edit`, language `en`, autosave and forcesave turned on, ONLYOFFICE logo hidden. The user is `{ id: userId, name: user?.name || "User" }`.

  It signs `editorConfig` into `token` and returns the document plus `fileUrl`, `documentKey`, `callbackUrl`, `token` and `editorConfig`. `BACKEND_URL` falls back to `req.protocol://host`.

### Mutations (creator only)
- **`updateDocument`** (L509-L560): only the creator can call it. It changes `title` and/or replaces the whole `collaborators` array with whatever the body sends. The array is not validated.
- **`deleteDocument`** (L565-L612): only the creator can call it. It tries to delete the S3 object first; if that fails it logs the error and deletes the database record anyway.
- **`addCollaborator`** (L859-L917): only the creator can call it. Body `{ collaboratorId }`. Returns 400 if the user is already a collaborator, comparing ids as strings. It does not check that the collaborator exists or belongs to the organisation.
- **`removeCollaborator`** (L922-L966): only the creator can call it. It filters `collaboratorId` (a path param) out of the list.

### ONLYOFFICE-facing endpoints (no user auth)
- **`serveDocumentFile`** (L618-L672): finds the document by `_id` only, with no organisation or user check. It streams the S3 bytes with `Content-Type`, `Content-Length` and `Content-Disposition: attachment; filename="<title>.<ext>"`. Each request is logged in detail.
- **`onlyofficeCallback`** (L678-L854): ONLYOFFICE posts here whenever the editing state changes.
  1. It looks for a JWT in `Authorization: Bearer ...` and then in `body.token`. If either verifies, it uses `decoded.payload || decoded` as the payload. **If verification fails, or no token is sent, it logs the fact and carries on with the raw request body** (see Notes).
  2. It reads `status, url, key, users, actions` from the payload and logs what the status code means (0-7).
  3. Status `2` (ready to save) or `6` (force-save) triggers a save. It downloads `url` with a 30-second `AbortController` timeout, rejects a non-OK or empty response, and overwrites the same S3 key (`filePath`) with metadata `version = old+1`. It then increments `version`, updates `size` and sets `lastModifiedBy = users[0]`.
  4. It replies `{ error: 0 }` on success or when nothing needs doing, and `{ error: 1 }` when the fetch or upload fails. A document that cannot be found is answered with `{ error: 0 }`, so ONLYOFFICE stops retrying.

## Exports
- `CollaborativeDocumentController` - a class with static `(req, res)` handlers: `createDocument`, `createFromFile`, `getDocuments`, `getDocumentById`, `updateDocument`, `deleteDocument`, `serveDocumentFile`, `onlyofficeCallback`, `addCollaborator`, `removeCollaborator`.

## Interfaces
- **Endpoints served** (all take `?organizationId=`, except the file endpoint):
  - `POST /backend/cabinet/documents` - `requireAuth`, `createDocument`
  - `POST /backend/cabinet/documents/from-file` - `requireAuth`, `createFromFile`
  - `GET /backend/cabinet/documents` - `requireAuth`, `getDocuments`
  - `GET /backend/cabinet/documents/:documentId` - `requireAuth`, `getDocumentById` (returns the editor config)
  - `PUT /backend/cabinet/documents/:documentId` - `requireAuth`, `updateDocument`
  - `DELETE /backend/cabinet/documents/:documentId` - `requireAuth`, `deleteDocument`
  - `POST /backend/cabinet/documents/:documentId/callback` - **no auth**, `onlyofficeCallback`
  - `GET /backend/cabinet/documents/:documentId/file` - **no auth**, `serveDocumentFile`
  - `POST /backend/cabinet/documents/:documentId/collaborators` - `requireAuth`, `addCollaborator`
  - `DELETE /backend/cabinet/documents/:documentId/collaborators/:collaboratorId` - `requireAuth`, `removeCollaborator`
- **Database:** `CollaborativeDocument` (model `CollaborativeDocument`, default collection `collaborativedocuments`) - read and write. `UserFile` (from `cabinet.model.ts`) - read only. `createdBy` and `collaborators` are populated from users.
- **External services:** AWS S3 through `s3Service`; ONLYOFFICE Document Server, which calls back into this controller and serves the edited file at the callback `url`.
- **Environment variables:** `ONLYOFFICE_JWT_SECRET` - signs and verifies editor and callback JWTs. `BACKEND_URL` - the public base URL put into `fileUrl` and `callbackUrl`.

## Dependencies
- **Internal:** `server/models/collaborativeDocument.model.ts` - `CollaborativeDocument` model and `DocumentType`. `server/models/cabinet.model.ts` - `UserFile`, loaded dynamically. `server/services/s3.ts` - `s3Service.uploadFile/getFile/deleteFile`.
- **Packages:** `express` (types). `crypto` (random key part). `jsonwebtoken` (ONLYOFFICE tokens). `docx`, `exceljs`, `pptxgenjs` (blank templates).

## Used by
- `server/routes/cabinet.ts`, which `server/app.ts` mounts at `/cabinet`.
- Frontend callers include `components/dashboard/OnlyOfficeEditor.tsx`, `components/dashboard/DocumentEditorOverlay.tsx`, `components/dashboard/CabinetPage.tsx` and `app/(dashboard)/cabinet/editor/[documentId]/page.tsx`.

## Notes
- **Callback trust:** `onlyofficeCallback` accepts an unsigned body, and also a body whose JWT failed to verify. Anyone who knows a document id can post `{status: 2, url: <attacker URL>}` and overwrite that document in S3 with any content. The same handler makes the server fetch any URL given to it, which is a server-side request forgery (SSRF) path.
- **File endpoint:** `serveDocumentFile` has no auth. Anyone who knows or can guess a document's ObjectId can download it.
- **Secret fallback:** if `ONLYOFFICE_JWT_SECRET` is unset, line 16 falls back to a hardcoded default secret (a weak, guessable placeholder string). `server/config/env.ts` has the same fallback.
- **Callback URL host:** the callback URL is built from `BACKEND_URL` with no `/backend` prefix. When `BACKEND_URL` points at the combined app origin rather than a `BACKEND_HOSTS` host, ONLYOFFICE would hit Next.js instead of Express. Check how `BACKEND_URL` is set in each deployment.
- **Editor user name:** `requireAuth` does not set `req.user.name`, so the ONLYOFFICE user name is always `"User"`.
- **Versions:** every save overwrites the same S3 key, so older versions are not kept unless the bucket has versioning turned on. `version` is only a counter.
- **Logging:** callback and file-serve requests log heavily, including the raw callback body.
