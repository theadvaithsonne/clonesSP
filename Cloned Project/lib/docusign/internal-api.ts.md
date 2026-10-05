# `lib/docusign/internal-api.ts`

> Authenticated client for the Docusign **internal** flow: documents whose recipients are org members who log in to Garage and sign, covering creation, recipients, fields, signing, reminders, bundles, verification and evidence download.

**Kind:** frontend library · **Lines:** 377

## Purpose
Garage's e-signature feature (branded "Docusign" in the code, "Garage Docs" in emails) runs on a separate Docusign service. This module wraps that service's `documents/` routes, backed by its `ds_*` collections, for the internal flow. Its external twin is `external-api.ts` (`esign-documents/`); the two share no state. Cross-flow endpoints (folders, templates, admin, branding, analytics) are in `shared-api.ts`. It is used by the Agreements tab, the upload dialog, the field editor, the signing view, the dashboard and the Docusign store slices.

## How it works
All JSON calls use `api()` + `url()` from `client.ts`: full URL under `DOCUSIGN_URL` (external service, default `https://docusign.garage.app/docusign/v1/`), `garage_tok` Bearer token, 30 s timeout, `DocusignAuthExpiredError` on 401, and thrown errors carrying `status` (plus `errors` / `documentId` when the service sends them). Responses are `{ status: boolean, data: ... }`.

**Org scoping.** Mutations that create or reorganise org data (`createDocument`, `moveDocuments`, `createDocumentBundle`, `setRecipients`) add `orgId: getOrgId()` (the currently selected org in `localStorage["garage_org_id"]`) to the body, matching how the rest of the codebase scopes calls. The service still validates it against the org derived from the JWT.

### Types (L9-L88)
- `DsDocument` - one envelope: title, owner, `originalFileUrl` (the envelope-ID-stamped working copy everyone views and signs) and `rawUploadedFileUrl` (the unstamped upload, kept for traceability), `envelopeId`, flattened signed file and certificate URLs/keys/hash, `signingOrder` (`sequential` | `parallel`), `deliveryMode` (`shared` | `separate`; absent = shared) and `batchId`, bundle fields, `folderId` (null = Global), integrity fields (`originalFileHash`, `originalFileHashSource`, `originalIntegrity`, `auditChainHash`, `auditChainEvents`), `status` (`draft | sent | in_progress | completed | voided`), `message`, snapshotted `orgName`/`orgLogoUrl` (brand emails and the Certificate of Completion), `reminderFrequency` (`none | daily | weekly`), timestamps including `expiresAt`, `myRecipientStatus`, a `recipients` summary (on `listSentByMe`), and `ownerName/Email/Image` (on `listAllInOrg`, resolved server-side because `ownerUserId` is a `ds_user` id that cannot be matched against org member lists).
- `DsRecipient` - a logged-in recipient (`userId`, `email`, `order`, `status`). `inviteEmailStatus` can still be `pending` right after Send because emails are queued and retried in the background; `failed` means the sender should use "Resend reminder".

### Documents and listing (L90-L189)
- `createDocument(data)` - create a draft from an uploaded PDF URL; `folderId` is founder/admin only (403 otherwise); `originalFileHash` comes from `sha256Hex` before upload; optional sender `message` appears in the sign-request email.
- `listSentByMe(page, limit)`, `listAssignedToMe(page, limit)` - real server-side pagination.
- `listAllInOrg(status?, page, limit, scope?, folderId?)` - the org-wide Agreements list (founder/admin only). `status` is comma-separated; `scope` `"sent"` / `"assigned"` replaces the old separate tabs; `folderId` `"unfiled"` = no folder.
- `getDocumentStats(folderId?)` - counts by status (folder-scoped when given) plus the caller's org-wide `assignedToMePending`.
- `moveDocuments(ids, folderId|null)` - up to 200 at once, any status.
- `getDocumentDetail(id)` - document, recipients, fields, newest-first first audit-log page, `auditHasMore`; `getAuditLogPage(id, before?)` continues with a keyset cursor (`beforeCreatedAt` + `beforeId` of the oldest shown entry).
- `sendDocument(id)` - for `separate` delivery returns immediately with `job: { batchId, total }` while copies build in the background. `getCopiesProgress(id)` polls (owner or founder/admin; polling also revives a job whose server restarted) and `retryFailedCopies(id)` requeues failures.
- `voidDocument(id)`.

### Bundles (L191-L222)
Two to three documents sent together to the same people. `createDocumentBundle` creates one draft per PDF linked by `bundleId` (shared message and folder). `getDocumentBundle` returns `DsBundle<DsRecipient>`. `syncBundleRecipients` sets the single recipient list for every member; people who stay keep their recipient ids so placed fields survive. `sendDocumentBundle` sends all members with one email per person; a 400 carries `documentId` on the thrown error so the editor can open the offending document. `resendDocumentBundle` sends one combined reminder per pending person (at most once per 10 minutes per group).

### Recipients and fields (L224-L265)
`setRecipients(id, { signingOrder, deliveryMode?, recipients })` (PUT, with `orgId`), `listRecipients(id)`, `setFields(id, { fields })` (PUT; field geometry, type, required, optional `fontSize`/`color`), `listFields(id)`.

### Signing (L267-L342)
- `viewDocumentAsRecipient(id)` - the signer's view: document, `myFields`, `allFields`, `canSign`, `waitingFor` (name and position when a sequential document is waiting on someone else), `myStatus`, `consent` (exact consent wording and version), `myEmailVerified` (verified once for a whole group), and `bundle` (a `DsBundleStepper` for grouped documents). Newer fields are optional for older backends.
- `requestEmailVerification(id)` / `confirmEmailVerification(id, code)` - email OTP step before signing.
- `signDocument(id, { fields, signatureType, signatureImageUrl, consentGiven: true, consentTextVersion? })` - the backend hard-rejects (400) any sign request without `consentGiven`, as ESIGN/UETA require affirmative consent. `signatureImageUrl` is an S3 URL obtained from `uploadDocusignFile`.
- `declineDocument(id, reason?)`.
- `resendDocument(id, recipientIds?)` - reminder to chosen recipients, or by default whoever is up now (sequential) or everyone unsigned (parallel). The server never emails people who already signed/declined; response may be `queued` and lists `sent` / `failed`.
- `getCertificate(id)` - certificate and flattened file URLs plus hash. `verifyDocument(id)` - `DsVerifyResult`.

### Files and evidence (L344-L376)
- `getDocumentFileLink(id, kind)` - link to the `original`, `signed` or `certificate` file. Going through the service (instead of opening the storage URL) records the download in the audit trail.
- `downloadEvidencePackage(id)` - owner/founder/admin, completed documents only: a zip with signed PDF, certificate, original, audit trail, signer details, consent wording and hashes. Raw `fetch` with a manual Bearer header (a plain link cannot send it) and the 120 s timeout; 401 -> `DocusignAuthExpiredError`; returns `{ blob, filename, sha256 }` from `Content-Disposition` (default `evidence-package.zip`) and `X-Evidence-Package-SHA256`.

## Exports
- Types: `DsDocument`, `DsRecipient`.
- Documents: `createDocument`, `listSentByMe`, `listAssignedToMe`, `listAllInOrg`, `getDocumentStats`, `moveDocuments`, `getDocumentDetail`, `getAuditLogPage`, `sendDocument`, `getCopiesProgress`, `retryFailedCopies`, `voidDocument`.
- Bundles: `createDocumentBundle`, `getDocumentBundle`, `syncBundleRecipients`, `sendDocumentBundle`, `resendDocumentBundle`.
- Recipients/fields: `setRecipients`, `listRecipients`, `setFields`, `listFields`.
- Signing: `viewDocumentAsRecipient`, `requestEmailVerification`, `confirmEmailVerification`, `signDocument`, `declineDocument`, `resendDocument`, `getCertificate`, `verifyDocument`.
- Files: `getDocumentFileLink(id, kind)`, `downloadEvidencePackage(id)`.

## Interfaces
- **External services (Docusign service, relative to `DOCUSIGN_URL`):**
  - `POST documents`; `GET documents?status&page&limit&scope&folderId`; `GET documents/me/sent`; `GET documents/me/assigned`; `GET documents/stats?folderId`; `POST documents/move`
  - `GET documents/:id`; `GET documents/:id/audit-log`; `POST documents/:id/send`; `GET documents/:id/copies-progress`; `POST documents/:id/copies-retry`; `POST documents/:id/void`
  - `PUT|GET documents/:id/recipients`; `PUT|GET documents/:id/fields`
  - `GET documents/:id/view`; `POST documents/:id/verify-email/request`; `POST documents/:id/verify-email/confirm`; `POST documents/:id/sign`; `POST documents/:id/decline`; `POST documents/:id/resend`
  - `GET documents/:id/certificate`; `GET documents/:id/verify`; `GET documents/:id/files/:kind`; `GET documents/:id/evidence` (zip)
  - `POST documents/bundle`; `GET documents/bundle/:bundleId`; `PUT .../recipients`; `POST .../send`; `POST .../resend`
- **Browser storage / cookies:** `localStorage["garage_tok"]` (token) and `localStorage["garage_org_id"]` (org) via `lib/auth.ts`.

## Dependencies
- **Internal:**
  - `lib/docusign/client.ts` - `api`, `url`, `withQuery`, `timeoutSignal`, `UPLOAD_TIMEOUT_MS`, `DocusignAuthExpiredError`.
  - `lib/docusign/types.ts` - shared types (`DsAuditLogEntry`, `DsBundle`, `DsBundleStepper`, `DsCopiesProgress`, `DsDeliveryMode`, `DsField`, `DsPagination`, `DsVerifyResult`, `FolderFilter`).
  - `lib/auth.ts` - `getToken()`, `getOrgId()`.
- **Packages:** none.

## Used by
`components/dashboard/docusign/DocusignDashboardView.tsx`, `components/dashboard/docusign/analytics/RecentDocumentsTable.tsx`, `components/dashboard/docusign/internal/AgreementsView.tsx`, `components/dashboard/docusign/internal/DocumentUploadDialog.tsx`, `components/dashboard/docusign/internal/DocumentsList.tsx`, `components/dashboard/docusign/internal/SigningView.tsx`, `components/dashboard/docusign/shared/TemplatesList.tsx`, `components/dashboard/docusign/shared/documentSeed.ts`, `lib/docusign/shared-api.ts` (type-only), `store/docusign/internalSlice.ts`, `store/docusign/sharedSlice.ts`.

## Notes
- `downloadEvidencePackage` and `downloadExternalEvidencePackage` (in `external-api.ts`) are intentional near-duplicates differing only in the route prefix.
- The comment on `createDocument` points to `components/dashboard/docusign/DocumentUploadDialog.tsx`; the dialog actually lives at `components/dashboard/docusign/internal/DocumentUploadDialog.tsx`.
- No Docusign traffic goes to the in-repo Express backend (`/backend/*`).
