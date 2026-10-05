# `lib/docusign/types.ts`

> Shared TypeScript types and two constants for the Docusign (Garage e-signature) feature: types used by both the internal and external flows plus cross-cutting ones for folders, templates, admin, analytics, audit trail, verification, branding and bundles.

**Kind:** frontend library · **Lines:** 331

## Purpose
The Docusign client is split into `internal-api.ts` (logged-in org signers), `external-api.ts` (outsiders), `public-api.ts` (unauthenticated signer) and `shared-api.ts` (cross-flow resources). Types needed by more than one of those, and by the many UI components under `components/dashboard/docusign/`, live here so no flow-specific module has to import another. `DsField` sits here rather than in `internal-api.ts` because the unauthenticated external signer (`public-api.ts`) also consumes it. This file contains only types and constants; it has no runtime logic or imports.

## How it works
The shapes describe JSON returned by the external Docusign service (default `https://docusign.garage.app/docusign/v1/`). Many fields are optional with comments explaining that they are absent on an older backend; UI code must treat absence as the documented fallback.

### Core and identity
- `DsPagination` - `{ page, limit, total, totalPages }` on every paginated list.
- `DsUser` - the synced Docusign profile (`ds_user`): `userId` (main Garage user id), `orgId`, `email`, `name`, `image`, platform `role` (`founder` | `stakeholder`), `isDocusignAdmin`, `isDocusignSender` (absent on rows created before the Sender role; treat as false), `status`.
- `DsRole` - effective role `"founder" | "admin" | "sender" | null` (null = may only sign what is sent). See `access.ts`.
- `DsAssignableRole` - what the Members dropdown can set: `"admin" | "sender" | "none"` (founders are not assignable).
- `DsDeliveryMode` - `"shared"` (one envelope) or `"separate"` (one independent copy per recipient, linked by `batchId`).

### Folders
- `DsFolder` - a flat, founder/admin-managed label. `documentCount` is combined across both flows; `internalCount` / `externalCount` let each tab's folder rail show only what its list will show (fallback to the combined count on older backends).
- `FolderFilter` - list/stats filter: omitted = every folder, `"unfiled"` = documents with no folder (Global), otherwise a folder id. Typed as `"unfiled" | (string & {})` to keep editor autocompletion for the literal.

### Fields, audit and templates
- `DsField` - a placed field: geometry in page coordinates, `type` (`signature`, `initials`, `stamp`, `date`, `text`, `checkbox`, `name`, `first_name`, `last_name`, `email`, `company`, `title`), `required`, optional sender styling `fontSize` (PDF points) and `color` (`#rrggbb`; absent = auto-sized black), and filled `value` / `checked`.
- `DsAuditLogEntry` - one audit event: actor ids/email/name, `action`, free-form `metadata`, `ip`, `userAgent`, `createdAt`.
- `DsTemplate` - reusable PDF plus field layout; each field has an abstract `recipientSlot` number instead of a recipient id.

### Admin members
- `DsAdminMember` - the UI-ready row on Admin -> Members. With `scope=roles` it comes directly from `GET admin/members` (Docusign service only). With `scope=all` it is assembled client-side by merging the org's real member list (the main backend's `/public/organizations/:orgId/users`, also used by `RecipientsPanel`) with `DsAdminOverlay`, the only way to discover members with no Docusign role yet. Includes `synced`, `documentsSent` (drafts excluded, internal + external) and `pendingSignatures`.
- `DsAdminOverlay` - what `scope=all` returns: role and counts keyed by `userId`, without name/email/avatar.

### Analytics
- `DsAnalyticsRange` - `"1w" | "1m" | "3m" | "ytd" | "all"`.
- `DsAnalyticsKpi` - `value`, `change` (null when no prior period exists, i.e. ytd/all) and a daily `trend`.
- `DsAnalyticsSummary` - `totals` (org-wide current status snapshot, internal + external merged, not range-scoped), four KPIs (`totalDocuments`, `sent`, `completed`, `pendingSignatures`), `signingActivity` series, `topSenders` (with `percent`), `recipientStatus` counts.

### Sending and integrity
- `DsCopiesProgress` - progress of a separate-copies send: `status` (`preparing | running | done`), `total`, `created` (includes the first recipient's copy, which exists from the moment of sending), `remaining`, `failed`, `failedItems`, `completedAt`. `stalled` is kept for older clients and is always false now that the backend restarts stalled jobs itself.
- `DsVerifyResult` - "Verify integrity" result: `valid`, `storedHash`, `computedHash`, optional `auditTrail` (`checked: false` = completed before audit fingerprints existed; `intact: false` = an event was edited or deleted) and optional `original` (hash, `source` `upload | completion`, `integrity` `match | mismatch | unverified`).

### Branding (Admin -> Branding)
The service owns the email catalog, default wording and limits; nothing here duplicates that content.
- `DsEmailKind` - `signature_request`, `your_turn`, `recipient_signed`, `declined`, `completed`, `verification_code`, `shared_with_you`.
- `DsEmailContent` - `subject`, `heading`, `body`, `buttonLabel`; `""` means the default wording.
- `DsBrandingLayout` (`centered | left`), `DsBrandingLogoSize` (`small | medium | large`).
- `DsBranding` - editable settings: `replyToEmail`, `footerText`, `accentColor`, `layout`, `logoSize`, and `content` per email kind. The org's name and logo are not editable here.
- `DsBrandingCatalogItem` - per email: label, description, allowed `{{tokens}}` (and a stricter `subjectTokens` set), `tokenLabels`, `hasButton`.
- `DsBrandingEditor` - GET branding payload: `branding`, `isSaved`, `updatedAt`, `defaults`, `catalog`, `limits` (max lengths for `footerText`, `subject`, `heading`, `body`, `buttonLabel`), `productName`.
- `DsBrandingFieldError` - `{ field, message }`, where `field` is a path such as `content.signature_request.heading`.
- `DsBrandingPreview` - rendered `subject`, `html`, full `from` header, `replyTo`, and `errors`.

### Bundles (grouped documents)
2-3 different documents sent together to the same people; each member is an ordinary document.
- `MAX_BUNDLE_DOCUMENTS = 3`, `MAX_BUNDLE_RECIPIENTS = 25`.
- `DsBundleMember` - one member in the sender's editor, including `fieldCount` and `recipientsWithoutFields` (sending is blocked until this is empty).
- `DsBundle<R>` - `bundleId`, `size`, `documents`, and the shared `recipients: R[]` (`DsRecipient` or `DsExternalRecipient`).
- `DsBundleStepper` - the signer's view: every document they are on with document `status` and their own `myStatus`.

## Exports
Interfaces/types: `DsPagination`, `DsUser`, `DsRole`, `DsAssignableRole`, `DsDeliveryMode`, `DsFolder`, `FolderFilter`, `DsField`, `DsAuditLogEntry`, `DsTemplate`, `DsAdminMember`, `DsAdminOverlay`, `DsAnalyticsRange`, `DsAnalyticsKpi`, `DsAnalyticsSummary`, `DsCopiesProgress`, `DsVerifyResult`, `DsEmailKind`, `DsEmailContent`, `DsBrandingLayout`, `DsBrandingLogoSize`, `DsBranding`, `DsBrandingCatalogItem`, `DsBrandingEditor`, `DsBrandingFieldError`, `DsBrandingPreview`, `DsBundleMember`, `DsBundle<R>`, `DsBundleStepper`.

Constants: `MAX_BUNDLE_DOCUMENTS` (3), `MAX_BUNDLE_RECIPIENTS` (25).

## Dependencies
- **Internal:** none.
- **Packages:** none.

## Used by
`app/(dashboard)/workspace/sign/[token]/PublicSigningView.tsx`, `components/dashboard/docusign/DocusignDashboardView.tsx`, `components/dashboard/docusign/DocusignPage.tsx`, the analytics widgets (`DateRangeToggle`, `DocumentStatusDonut`, `KpiCard`, `SigningActivityChart`, `TopSendersList`), the external editor components (`ExternalFieldEditorView`, `ExternalRecipientsPanel`, `ExternalSignaturesList`), the internal components (`AgreementsView`, `DocumentsList`, `FieldEditorView`, `RecipientsPanel`, `SigningView`), shared components (`AuditTrailView`, `BundleBar`, `BundleSteps`, `CopiesProgressPanel`, `FieldStylePanel`, `FolderRail`, `PdfFilesPicker`, `TemplatesList`, `admin/MembersTab`), and 17 more (42 importers in total), including every other `lib/docusign/*` module.

## Notes
- `DsAuditLogEntry.metadata` is typed `any`.
- The header comment says these types are shared by both flows, but the internal document/recipient types (`DsDocument`, `DsRecipient`) live in `internal-api.ts` and the external ones in `external-api.ts`.
