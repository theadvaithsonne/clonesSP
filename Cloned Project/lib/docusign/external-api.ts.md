# `lib/docusign/external-api.ts`

> Authenticated client for the Docusign **external** flow: documents sent to people without a Garage account, which the founder/admin either fills in and completes on their behalf or sends out as a public no-login signing link.

**Kind:** frontend library · **Lines:** 310

## Purpose
The Garage e-signature feature has two independent document flows. The internal flow (`internal-api.ts`, `documents/` routes) is for org members who log in and sign. This file covers the external flow, backed by the separate Docusign service's `esign_*` collections and its `esign-documents/` routes. It defines the external document/recipient/field types and one function per endpoint the sender-side UI (External Signatures tab, external field editor, recipients panel, store slices) needs. The signer's own unauthenticated calls live in `public-api.ts`, not here.

## How it works
Every JSON call goes through `api()` + `url()` from `client.ts`, so requests go to `DOCUSIGN_URL` (an external service, default `https://docusign.garage.app/docusign/v1/`) with the `garage_tok` Bearer token, a 30 s timeout, and `DocusignAuthExpiredError` on 401. Responses follow `{ status: boolean, data: ... }`.

### Types (L16-L94)
- `DsExternalDocument` - deliberately separate from the internal `DsDocument`. Status is `draft | sent | in_progress | completed | voided`; `sent`/`in_progress` exist only on the send-for-signature path, while fill-on-behalf goes straight from draft to completed. Carries folder (`folderId`, null = Global, shared `ds_folder` list), delivery mode and `batchId`, bundle membership (`bundleId`, `bundleIndex`, `bundleSize`), sender `message`, snapshotted `orgName`/`orgLogoUrl`, the recipients summary (on list results), and integrity data: `flattenedFileUrl/Key/Hash`, `certificateFileUrl`, `originalFileHash` + `originalFileHashSource` (`upload` | `completion`), `originalIntegrity` (`match` | `mismatch` | `unverified`), `auditChainHash`, `auditChainEvents`.
- `DsExternalRecipient` - identified by email; status `pending | viewed | signed | declined`, timestamps, signature type/image, and for send-for-signature only, invite-email delivery status (`inviteEmailStatus`, `inviteEmailAt`, `inviteEmailError`; never the raw token) and `emailVerifiedAt`.
- `DsExternalField` - placed field geometry (`page`, `x`, `y`, `width`, `height`), `type` (same union as `DsField`), `required`, optional `fontSize`/`color`, and filled `value`/`checked`.

### Document lifecycle
- `createExternalDocument` - `POST esign-documents` with title, uploaded file URL/key, page count, browser-computed `originalFileHash`, optional `folderId` and optional sender `message` (trimmed and capped at 1000 characters by the backend; shown in the invite or the "here is your copy" email with the sender's name and role).
- `listMyExternalDocuments(page=1, limit=20, folderId?, status?)` - status is a comma-separated list filtered server-side so pagination stays correct.
- `getExternalDocumentStats(folderId?)` - counts per status plus total.
- `moveExternalDocuments(ids, folderId|null)` - file up to 200 documents into a folder, or back to Global; allowed at any status.
- `getExternalDocumentDetail(id)` - document, recipients, fields and the newest-first first page of the audit log plus `auditHasMore` (absent on older backends, treated as "no more").
- `getExternalAuditLogPage(id, before?)` - "Load earlier activity" with a keyset cursor (`beforeCreatedAt`, `beforeId`).
- `setExternalRecipients(id, { deliveryMode?, recipients })` and `setExternalFields(id, { fields })` - replace recipients / fields (PUT).
- `voidExternalDocument(id)`.

### Two ways to complete
1. **Fill on behalf** - `fillOnBehalfExternalDocument(id, { fields, signaturesByRecipient })`: the founder fills every recipient's fields in one request and the document completes immediately; recipients only receive the finished PDF by email. At most one captured signature per recipient, keyed by recipientId, because the backend's `flattenSignedPdf` keys signature images that way.
2. **Send for signature** - `sendExternalDocument(id)`: emails each recipient a public no-login link (the page at `/workspace/sign/[token]`, see `public-api.ts`). For `deliveryMode: "separate"` the response includes `job: { batchId, total }` and per-recipient copies are built in the background; `getExternalCopiesProgress` polls progress and `retryExternalFailedCopies` requeues failures. `resendExternalDocument(id, recipientIds?)` re-sends the "please sign" email to the chosen recipients, or by default to whoever has not signed/declined (or is next in a sequential order); the response may be `queued` or list `sent`/`failed`.

### Bundles (2-3 documents sent together)
Same contract as the internal bundle calls, recipients identified by email: `createExternalDocumentBundle` (`POST esign-documents/bundle`), `getExternalDocumentBundle`, `syncExternalBundleRecipients` (one shared list for every member), `sendExternalDocumentBundle`, and `resendExternalDocumentBundle` (one reminder per pending person with a fresh link covering every document of the group).

### Integrity and evidence
- `verifyExternalDocument(id)` - recomputes the signed file hash and audit-trail fingerprint (`DsVerifyResult`).
- `downloadExternalEvidencePackage(id)` - raw `fetch` (binary zip, not JSON) with a manually attached Bearer header and the 120 s timeout. Maps 401 to `DocusignAuthExpiredError`, other failures to the body's `message` when JSON. Returns the blob, the filename parsed from `Content-Disposition` (default `evidence-package.zip`) and the `X-Evidence-Package-SHA256` header. Mirrors `downloadEvidencePackage` in `internal-api.ts`.

## Exports
- Types: `DsExternalDocument`, `DsExternalRecipient`, `DsExternalField`.
- `createExternalDocument(data)`, `listMyExternalDocuments(page?, limit?, folderId?, status?)`, `getExternalDocumentStats(folderId?)`, `moveExternalDocuments(documentIds, folderId)`, `getExternalDocumentDetail(id)`, `getExternalAuditLogPage(id, before?)`, `setExternalRecipients(id, data)`, `setExternalFields(id, data)`, `voidExternalDocument(id)`.
- Bundles: `createExternalDocumentBundle(data)`, `getExternalDocumentBundle(bundleId)`, `syncExternalBundleRecipients(bundleId, recipients)`, `sendExternalDocumentBundle(bundleId)`, `resendExternalDocumentBundle(bundleId)`.
- Sending: `sendExternalDocument(id)`, `getExternalCopiesProgress(id)`, `retryExternalFailedCopies(id)`, `resendExternalDocument(id, recipientIds?)`.
- `verifyExternalDocument(id)`, `downloadExternalEvidencePackage(id): Promise<{ blob; filename; sha256 }>`, `fillOnBehalfExternalDocument(id, data)`.

## Interfaces
- **External services (Docusign service, relative to `DOCUSIGN_URL`):**
  - `POST esign-documents`; `GET esign-documents?page&limit&folderId&status`; `GET esign-documents/stats?folderId`; `POST esign-documents/move`
  - `GET esign-documents/:id`; `GET esign-documents/:id/audit-log?beforeCreatedAt&beforeId`
  - `PUT esign-documents/:id/recipients`; `PUT esign-documents/:id/fields`; `POST esign-documents/:id/void`
  - `POST esign-documents/:id/send`; `GET esign-documents/:id/copies-progress`; `POST esign-documents/:id/copies-retry`; `POST esign-documents/:id/resend`
  - `GET esign-documents/:id/verify`; `GET esign-documents/:id/evidence` (zip); `POST esign-documents/:id/fill-on-behalf`
  - `POST esign-documents/bundle`; `GET esign-documents/bundle/:bundleId`; `PUT .../recipients`; `POST .../send`; `POST .../resend`
- **Browser storage / cookies:** `getToken()` (`localStorage["garage_tok"]`) for the evidence download; the rest via `client.api()`.

## Dependencies
- **Internal:**
  - `lib/docusign/client.ts` - `api`, `url`, `withQuery`, `timeoutSignal`, `UPLOAD_TIMEOUT_MS`, `DocusignAuthExpiredError`.
  - `lib/docusign/types.ts` - shared types (`DsAuditLogEntry`, `DsBundle`, `DsCopiesProgress`, `DsDeliveryMode`, `DsField`, `DsPagination`, `DsVerifyResult`, `FolderFilter`).
  - `lib/auth.ts` - `getToken()`.
- **Packages:** none.

## Used by
`components/dashboard/docusign/DocusignDashboardView.tsx`, `components/dashboard/docusign/analytics/RecentDocumentsTable.tsx`, `components/dashboard/docusign/external/ExternalDocumentUploadDialog.tsx`, `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`, `components/dashboard/docusign/external/ExternalSignaturesList.tsx`, `components/dashboard/docusign/shared/TemplatesList.tsx`, `components/dashboard/docusign/shared/documentSeed.ts`, `lib/docusign/shared-api.ts` (type-only), `store/docusign/externalSlice.ts`, `store/docusign/sharedSlice.ts`.

## Notes
- Comments refer to the public signing page as `app/sign/[token]`; in this repo it lives at `app/(dashboard)/workspace/sign/[token]` (URL `/workspace/sign/[token]`).
- Comments such as "see getCopiesProgress/retryFailedCopies above" refer to functions in `internal-api.ts`, a leftover from when both flows lived in one file.
- Only founders/admins (and senders, per `access.ts`) are expected to reach this flow; the service enforces it.
