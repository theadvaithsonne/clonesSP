# `server/controllers/shareableLink.controller.ts`

> The `ShareableLinkController` class and its helpers: mints, revokes and resolves view-only share links (`{FRONTEND_URL}/f/{token}`) for cabinet files, with public and office-only access modes and a "join this office" path for office-only links.

**Kind:** Express controller · **Lines:** 967 · **Mounted at:** `/cabinet` and `/public/f` (browser: `/backend/cabinet`, `/backend/public/f`)

## Purpose
Cabinet files (personal `UserFile`, office `OrganizationFile`, and `FloorFile`) can be shared by link. Every link looks the same: an opaque 22-character token from `server/utils/shareableToken.ts`, with no `int_`/`pub_` prefix any more. What a link allows is stored on its `ShareableLink` record:
- An **external** link (`accessLevel: "public"`) opens for anyone.
- An **internal** link (`accessLevel: "restricted"`) opens only for signed-in members of the owning organisation.

The frontend viewer at `app/f/[token]` first tries the unauthenticated route. When that route asks for sign-in, the viewer retries the authenticated route, and on a `NOT_A_MEMBER` answer it offers to join the office.

## How it works

### Constants and mapping helpers (L12-L79)
- `LINK_EXPIRY_MS` = 30 days. `DEFAULT_MAX_ACCESS_COUNT` = 100. `PRESIGNED_URL_EXPIRY` = 3600 s.
- Types: `FileAccess` (`"public" | "office"`, used on files and in the API) and `AccessLevel` (`"public" | "restricted"`, stored on links).
- Mapping helpers: `linkTypeForAccess`, `accessForLinkType` and `accessLevelForLinkType` convert between the vocabularies (`public` ↔ `external`, `office` ↔ `internal`).
- `isPublicLink(link)` treats `accessLevel` as the source of truth and falls back to `linkType === "external"` for legacy records.
- `fileAccess(file)` reads `file.sharing.access` and defaults to `"office"`.
- `shareUrl(token)` builds `${env.FRONTEND_URL}/f/${token}`.
- `linkPayload(link, isNew, access)` builds the standard response object: `_id, token, linkType, access, url, expiresAt, accessCount, maxAccessCount, isNew`.

### `getOrRefreshLink` (L90-L148)
Returns the live link of a given type for a file, creating or reviving one when needed:
- **Reuse:** a link is reused if it is `active`, not expired, and under its access cap. Legacy records missing the correct `accessLevel` get it backfilled and saved.
- **Revive:** the model has a unique index on `{ file, linkType }`, so a revoked, expired or used-up record cannot be inserted again. Instead it is revived: new token (the old URL stays dead), `status: "active"`, a fresh 30-day expiry, the access count reset to 0, the cap reset to 100, and `fileModel`, `accessLevel` and `organization` updated.
- **Create:** otherwise a new `ShareableLink` is created.

### Membership and file helpers (L150-L223)
- `membershipFor(userId, orgId)` finds the matching entry in `User.organizations`.
- `isFounderMembership(m)` is true for `role === "founder"` or `fullAccess`.
- `loadLinkFile(link)` branches on `link.fileModel` to load from `OrganizationFile`, `FloorFile` or `UserFile`. It selects only `name originalName description mimeType size s3Key sharing organization`.
- `sharerNameFor(link)` returns the owner's `name`, then their email handle, then `"Someone"`.
- `linkPreviewMeta(link)` returns the "safe half" of a link: `sharedBy`, `fileName`, `fileDescription`, `mimeType`, `size`, `organizationId` and `organizationName`. It never includes an S3 key or URL. It is returned even for restricted links, so chat-app crawlers (WhatsApp, Slack) can title a link preview.

### Personal-file links
- **`getOrCreateLink`** (L230-L294). Requires `linkType` to be `"internal"` or `"external"` and a valid ObjectId `fileId`. The org comes from `?organizationId` or the token's `orgId`. The file must be a `UserFile` owned by the caller in that org. Returns 201 when the link is new and 200 when an existing one is reused.
- **`getLinksForFile`** (L901-L934). Lists every link the caller owns for `fileId`, newest first, with `url` and `status`.

### Organisation-file sharing (founder-controlled)
- **`getOrganizationFileSharing`** (L304-L357). Any org member can read the file's `access`, the currently active link's `url` and `expiresAt` (or `null`), and `canEdit` (founder or fullAccess).
- **`updateOrganizationFileSharing`** (L367-L443). Founder or fullAccess only. Body `{ access: "public" | "office" }`. It:
  1. writes `file.sharing = { access, updatedAt, updatedBy }` and `file.isPublic`;
  2. revokes every active link of the other type, so a file switched back to office-only stops resolving at its old public URL;
  3. returns the matching link from `getOrRefreshLink`.
- **`getOrCreateOrganizationLink`** (L453-L501). Any member can call it, but the link type follows the file's own access mode, not the caller's choice. The link owner is recorded as the file's owner (falling back to the caller).

### Revocation
- **`revokeLink`** (L507-L549). Allowed for the link's creator or any founder/fullAccess member of the owning org. It sets `status: "revoked"`. When the caller is not allowed, it returns 403 with the message "Link not found or you are not the owner".

### Resolution
- **`accessExternalLink`** (L799-L895), unauthenticated. Every viewer hits this route first.
  - Unknown token: 404.
  - Restricted link: 401 `code: "AUTH_REQUIRED"` with `linkPreviewMeta` data and nothing else about the file.
  - Otherwise `validateAndUpdateLink`; failure returns 410.
  - Missing file: 404.
  - An `OrganizationFile` whose `sharing.access` is no longer `"public"`: 403 `OFFICE_ONLY`.
  - On success: increments `accessCount`, sets `lastAccessedAt`, and returns file info, `sharedBy`, `organizationId`, `access: "public"`, `viewOnly: true`, and `viewUrl` (with a legacy duplicate key `downloadUrl`) from `s3Service.getPresignedStreamUrl(s3Key, 3600, mimeType)`. That presigned URL uses `inline` disposition, so the file renders instead of downloading.
- **`accessInternalLink`** (L561-L654), signed-in. Validates the link the same way (410 on failure). Public links skip the membership check. For a restricted link, a non-member gets 403 `code: "NOT_A_MEMBER"` with `{ organizationId, organizationName, canJoin: true }`. Members get the same success payload, with `access` set to `"public"` or `"office"`.
- **`getLinkMeta`** (L757-L787), unauthenticated. Returns `linkType`, `accessLevel`, `access`, `requiresMembership`, `requiresAuth`, `status` and the preview fields. It does not validate expiry and does not use up an access. Server-side metadata generation (`app/f/[token]/page.tsx`) reads this endpoint so that crawlers do not burn the 100-view cap.

### Joining an office
- **`joinOfficeViaLink`** (L666-L742), signed-in.
  - A public link returns 400, because there is no office to join.
  - Otherwise the link is validated (410 on failure) and the org must exist (404 if not).
  - If the user is not yet a member, it pushes `{ organization, role: "stakeholder", floorId: <lowest-level Floor of the org>, joinedAt }` onto `user.organizations` and logs `[ShareLink] ... joined ...`.
  - Returns `{ organizationId, organizationName, joined }`. The viewer then retries `/cabinet/f/:token`.

### `validateAndUpdateLink` (L941-L966)
Returns an error string, or `null` when the link is usable:
- `revoked` → "This link has been revoked"
- past `expiresAt` → "This link has expired", and status is persisted as `expired`
- `accessCount >= maxAccessCount` → "This link has reached its access limit", and status is persisted as `limit_reached`

## Exports
- `ShareableLinkController` - class of static Express handlers: `getOrCreateLink`, `getOrganizationFileSharing`, `updateOrganizationFileSharing`, `getOrCreateOrganizationLink`, `revokeLink`, `accessInternalLink`, `joinOfficeViaLink`, `getLinkMeta`, `accessExternalLink`, `getLinksForFile`.

## Interfaces
- **Endpoints served:**
  - `POST /backend/cabinet/files/:fileId/share-link` - `requireAuth` - `getOrCreateLink` (body `{ linkType }`, optional `?organizationId=`)
  - `GET /backend/cabinet/files/:fileId/share-links` - `requireAuth` - `getLinksForFile`
  - `DELETE /backend/cabinet/share-link/:token` - `requireAuth` - `revokeLink`
  - `GET /backend/cabinet/f/:token` - `requireAuth` - `accessInternalLink`
  - `POST /backend/cabinet/f/:token/join` - `requireAuth` - `joinOfficeViaLink`
  - `GET /backend/cabinet/organization/files/:fileId/sharing` - `requireAuth` - `getOrganizationFileSharing`
  - `PUT /backend/cabinet/organization/files/:fileId/sharing` - `requireAuth` - `updateOrganizationFileSharing` (body `{ access }`)
  - `POST /backend/cabinet/organization/files/:fileId/share-link` - `requireAuth` - `getOrCreateOrganizationLink`
  - `GET /backend/public/f/:token/meta` - no auth - `getLinkMeta`
  - `GET /backend/public/f/:token` - no auth - `accessExternalLink`
- **Database:**
  - `ShareableLink` (collection `shareablelinks`) - read/write
  - `UserFile`, `OrganizationFile`, `FloorFile` - read. `OrganizationFile.sharing`/`isPublic` - write.
  - `User` - reads `organizations`, `name` and `email`; writes a new `organizations` entry on join
  - `Organization` - reads `name`
  - `Floor` - reads the lowest `level` floor for the org
- **External services:** AWS S3 presigned GET URLs, through `s3Service`.
- **Environment variables:** `FRONTEND_URL` (via `env`) - base of every share URL. Defaults to `http://localhost:3000`.

## Dependencies
- **Internal:**
  - `server/models/shareableLink.model.ts` - link records
  - `server/models/cabinet.model.ts` - the three file models
  - `server/models/user.model.ts` - membership and sharer name
  - `server/models/organization.model.ts` - office name
  - `server/models/floor.model.ts` - ground floor on join
  - `server/services/s3.ts` - `getPresignedStreamUrl`
  - `server/config/env.ts` - `FRONTEND_URL`
  - `server/utils/shareableToken.ts` - `generateShareableToken`
- **Packages:** `express` - types. `mongoose` - `Types.ObjectId` validation and construction.

## Used by
- `server/routes/cabinet.ts` (mounted at `/cabinet`) and `server/routes/publicCabinet.ts` (mounted at `/public/f`, which declares `/:token/meta` before `/:token`).
- Frontend callers:
  - `app/f/[token]/page.tsx` - the meta endpoint
  - `app/f/[token]/ShareableLinkViewer.tsx` - the public, internal and join endpoints
  - `components/dashboard/CabinetPage.tsx` - personal share-link and share-links
  - `components/dashboard/FounderCabinetPage.tsx` - org-file sharing

## Notes
- **Security: an office-only link works as an invite.** Anyone holding a live restricted token can sign in and call `/join` to become a `stakeholder` of that organisation. Revoking the link (or switching the file to public) closes this path. Joining does not consume an access.
- `getLinkMeta` and the 401/403 bodies of `accessExternalLink` reveal the file name, sharer name and office name to anyone with the token, even for revoked or expired links. This is deliberate, so link previews work.
- Access counting is read-increment-`save()`, not atomic. Concurrent opens can slightly exceed `maxAccessCount`.
- `validateAndUpdateLink` compares against `link.maxAccessCount` with no default, while `getOrRefreshLink` falls back to `DEFAULT_MAX_ACCESS_COUNT`. Every record written here sets the field explicitly.
- `getLinksForFile` does not validate `fileId`. A malformed id likely surfaces as a 500 (a Mongoose CastError).
- `loadLinkFile` can resolve `FloorFile` links, but no handler in this file creates them.
- `accessInternalLink` does not repeat the `OFFICE_ONLY` check. Instead it relies on `updateOrganizationFileSharing` having revoked the public link when a file went back to office-only.
