# `server/routes/cabinet.ts`

> Express router with 62 endpoints, mounted at `/cabinet`.

**Kind:** Express router · **Lines:** 273 · **Mounted at:** `/cabinet` (browser: `/backend/cabinet`)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Endpoints (62)

| Method | Router path | Browser path | Middleware | Handler | Line |
|---|---|---|---|---|---|
| POST | `/documents` | `/backend/cabinet/documents` | `requireAuth` | `CollaborativeDocumentController.createDocument` | 13 |
| POST | `/documents/from-file` | `/backend/cabinet/documents/from-file` | `requireAuth` | `CollaborativeDocumentController.createFromFile` | 18 |
| GET | `/documents` | `/backend/cabinet/documents` | `requireAuth` | `CollaborativeDocumentController.getDocuments` | 23 |
| GET | `/documents/:documentId` | `/backend/cabinet/documents/:documentId` | `requireAuth` | `CollaborativeDocumentController.getDocumentById` | 28 |
| PUT | `/documents/:documentId` | `/backend/cabinet/documents/:documentId` | `requireAuth` | `CollaborativeDocumentController.updateDocument` | 33 |
| DELETE | `/documents/:documentId` | `/backend/cabinet/documents/:documentId` | `requireAuth` | `CollaborativeDocumentController.deleteDocument` | 38 |
| POST | `/documents/:documentId/callback` | `/backend/cabinet/documents/:documentId/callback` | — | `CollaborativeDocumentController.onlyofficeCallback` | 43 |
| GET | `/documents/:documentId/file` | `/backend/cabinet/documents/:documentId/file` | — | `CollaborativeDocumentController.serveDocumentFile` | 48 |
| POST | `/documents/:documentId/collaborators` | `/backend/cabinet/documents/:documentId/collaborators` | `requireAuth` | `CollaborativeDocumentController.addCollaborator` | 52 |
| DELETE | `/documents/:documentId/collaborators/:collaboratorId` | `/backend/cabinet/documents/:documentId/collaborators/:collaboratorId` | `requireAuth` | `CollaborativeDocumentController.removeCollaborator` | 57 |
| POST | `/files/upload` | `/backend/cabinet/files/upload` | `requireAuth`, `upload.single("file")` | `CabinetController.uploadFile` | 64 |
| GET | `/files/:fileId/download` | `/backend/cabinet/files/:fileId/download` | `requireAuth` | `CabinetController.getFileDownloadUrl` | 70 |
| GET | `/files/:fileId/stream` | `/backend/cabinet/files/:fileId/stream` | `requireAuth` | `CabinetController.streamFileDownload` | 75 |
| GET | `/files/:fileId/info` | `/backend/cabinet/files/:fileId/info` | `requireAuth` | `CabinetController.getFileInfo` | 80 |
| PUT | `/files/:fileId/rename` | `/backend/cabinet/files/:fileId/rename` | `requireAuth` | `CabinetController.renameFile` | 81 |
| DELETE | `/files/:fileId` | `/backend/cabinet/files/:fileId` | `requireAuth` | `CabinetController.deleteFile` | 82 |
| POST | `/files/:fileId/share-link` | `/backend/cabinet/files/:fileId/share-link` | `requireAuth` | `ShareableLinkController.getOrCreateLink` | 85 |
| GET | `/files/:fileId/share-links` | `/backend/cabinet/files/:fileId/share-links` | `requireAuth` | `ShareableLinkController.getLinksForFile` | 90 |
| DELETE | `/share-link/:token` | `/backend/cabinet/share-link/:token` | `requireAuth` | `ShareableLinkController.revokeLink` | 95 |
| GET | `/f/:token` | `/backend/cabinet/f/:token` | `requireAuth` | `ShareableLinkController.accessInternalLink` | 100 |
| POST | `/f/:token/join` | `/backend/cabinet/f/:token/join` | `requireAuth` | `ShareableLinkController.joinOfficeViaLink` | 107 |
| POST | `/` | `/backend/cabinet` | `requireAuth` | `CabinetController.createCabinet` | 114 |
| GET | `/` | `/backend/cabinet` | `requireAuth` | `CabinetController.getCabinets` | 115 |
| GET | `/default` | `/backend/cabinet/default` | `requireAuth` | `CabinetController.getOrCreateDefaultPersonalCabin…` | 116 |
| GET | `/floor` | `/backend/cabinet/floor` | `requireAuth` | `CabinetController.getFloorCabinets` | 121 |
| GET | `/search` | `/backend/cabinet/search` | `requireAuth` | `CabinetController.search` | 122 |
| GET | `/organization` | `/backend/cabinet/organization` | `requireAuth` | `CabinetController.getOrCreateOrganizationCabinet` | 125 |
| POST | `/organization/sub-cabinet` | `/backend/cabinet/organization/sub-cabinet` | `requireAuth` | `CabinetController.createOrganizationSubCabinet` | 130 |
| POST | `/organization/files/upload` | `/backend/cabinet/organization/files/upload` | `requireAuth`, `upload.single("file")` | `CabinetController.uploadFileToOrganizationCabinet` | 135 |
| POST | `/organization/recordings/upload` | `/backend/cabinet/organization/recordings/upload` | `requireAuth`, `upload.single("recording")` | `CabinetController.uploadRecordingToOrganizationCa…` | 141 |
| GET | `/organization/:id` | `/backend/cabinet/organization/:id` | `requireAuth` | `CabinetController.getOrganizationCabinetById` | 147 |
| POST | `/organization/files/:fileId/transcribe` | `/backend/cabinet/organization/files/:fileId/transcribe` | `requireAuth` | `CabinetController.transcribeOrganizationRecording` | 152 |
| GET | `/organization/files/:fileId/sharing` | `/backend/cabinet/organization/files/:fileId/sharing` | `requireAuth` | `ShareableLinkController.getOrganizationFileSharing` | 158 |
| PUT | `/organization/files/:fileId/sharing` | `/backend/cabinet/organization/files/:fileId/sharing` | `requireAuth` | `ShareableLinkController.updateOrganizationFileSha…` | 163 |
| POST | `/organization/files/:fileId/share-link` | `/backend/cabinet/organization/files/:fileId/share-link` | `requireAuth` | `ShareableLinkController.getOrCreateOrganizationLi…` | 168 |
| GET | `/organization/files/:fileId/download` | `/backend/cabinet/organization/files/:fileId/download` | `requireAuth` | `CabinetController.getOrganizationFileDownloadUrl` | 173 |
| GET | `/organization/files/:fileId/stream` | `/backend/cabinet/organization/files/:fileId/stream` | `requireAuth` | `CabinetController.streamOrganizationFileDownload` | 178 |
| PUT | `/organization/files/:fileId/rename` | `/backend/cabinet/organization/files/:fileId/rename` | `requireAuth` | `CabinetController.renameOrganizationFile` | 183 |
| DELETE | `/organization/files/:fileId` | `/backend/cabinet/organization/files/:fileId` | `requireAuth` | `CabinetController.deleteOrganizationFile` | 188 |
| PUT | `/organization/:id/rename` | `/backend/cabinet/organization/:id/rename` | `requireAuth` | `CabinetController.renameOrganizationCabinet` | 193 |
| GET | `/floor/:floorId` | `/backend/cabinet/floor/:floorId` | `requireAuth` | `CabinetController.getOrCreateFloorCabinet` | 200 |
| POST | `/floor/:floorId/sub-cabinet` | `/backend/cabinet/floor/:floorId/sub-cabinet` | `requireAuth` | `CabinetController.createFloorSubCabinet` | 205 |
| POST | `/floor/:floorId/files/upload` | `/backend/cabinet/floor/:floorId/files/upload` | `requireAuth`, `upload.single("file")` | `CabinetController.uploadFileToFloorCabinet` | 210 |
| GET | `/:id` | `/backend/cabinet/:id` | `requireAuth` | `CabinetController.getCabinetById` | 218 |
| PUT | `/:id` | `/backend/cabinet/:id` | `requireAuth` | `CabinetController.updateCabinet` | 219 |
| PUT | `/:id/rename` | `/backend/cabinet/:id/rename` | `requireAuth` | `CabinetController.renameCabinet` | 220 |
| DELETE | `/:id` | `/backend/cabinet/:id` | `requireAuth` | `CabinetController.deleteCabinet` | 221 |
| GET | `/files/all` | `/backend/cabinet/files/all` | `requireAuth` | `CabinetController.getAllUserFiles` | 224 |
| POST | `/files/cleanup` | `/backend/cabinet/files/cleanup` | `requireAuth` | `CabinetController.cleanupOrphanedFiles` | 225 |
| POST | `/floor/cleanup-duplicates` | `/backend/cabinet/floor/cleanup-duplicates` | `requireAuth` | `CabinetController.cleanupDuplicateFloorCabinets` | 230 |
| POST | `/migrate` | `/backend/cabinet/migrate` | `requireAuth` | `CabinetController.runMigration` | 235 |
| POST | `/share` | `/backend/cabinet/share` | `requireAuth` | `CabinetController.sharePersonalItem` | 238 |
| GET | `/share/:itemId/:itemType` | `/backend/cabinet/share/:itemId/:itemType` | `requireAuth` | `CabinetController.getItemShares` | 239 |
| GET | `/shared/with-me` | `/backend/cabinet/shared/with-me` | `requireAuth` | `CabinetController.getSharedWithMe` | 244 |
| GET | `/shared/by-me` | `/backend/cabinet/shared/by-me` | `requireAuth` | `CabinetController.getSharedByMe` | 245 |
| PUT | `/share/:shareId` | `/backend/cabinet/share/:shareId` | `requireAuth` | `CabinetController.updateShare` | 246 |
| DELETE | `/share/:shareId` | `/backend/cabinet/share/:shareId` | `requireAuth` | `CabinetController.revokeShare` | 247 |
| GET | `/shared/files/:fileId/download` | `/backend/cabinet/shared/files/:fileId/download` | `requireAuth` | `CabinetController.getSharedFileDownloadUrl` | 248 |
| GET | `/shared/files/:fileId/stream` | `/backend/cabinet/shared/files/:fileId/stream` | `requireAuth` | `CabinetController.streamSharedFileDownload` | 253 |
| GET | `/shared/cabinets/:cabinetId` | `/backend/cabinet/shared/cabinets/:cabinetId` | `requireAuth` | `CabinetController.getSharedCabinetContents` | 258 |
| GET | `/users/search` | `/backend/cabinet/users/search` | `requireAuth` | `CabinetController.getUsersByEmail` | 265 |
| GET | `/users/members` | `/backend/cabinet/users/members` | `requireAuth` | `CabinetController.getOrganizationMembers` | 266 |

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (router)` | default |  | 272 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `server/controllers/cabinet.controller.ts` — `CabinetController`, `upload`
  - `server/controllers/shareableLink.controller.ts` — `ShareableLinkController`
  - `server/controllers/collaborativeDocument.controller.ts` — `CollaborativeDocumentController`
  - `server/middleware/auth.ts` — `requireAuth`
- **Packages:**
  - `express` — `Router`

## Used by

- `server/app.ts`

Entry: mounted in `server/app.ts` at `/cabinet`.
