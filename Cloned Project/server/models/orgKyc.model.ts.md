# `server/models/orgKyc.model.ts`

> Mongoose model for an office's KYC record: which proofs a garage admin requires, what the founder submitted, and the review state.

**Kind:** Mongoose model · **Lines:** 145

## Purpose
Garage admins can ask an office (organization) to verify itself. The admin chooses which proofs are needed (the four built-ins - PAN card, business address proof, government ID, GST number - plus any custom field they type in), the founder fills them in from Manage Organization, and the admin approves or rejects. This file defines the one-document-per-organization record behind that flow.

It is a separate collection rather than a sub-document on `Organization` on purpose: the organization document is read on nearly every request, whereas KYC is read on two screens. `Organization` only carries a derived mirror (`kycStatus`, `kycVerifiedAt`) so listings can show a "verified office" badge without a second query.

## How it works
### Status lifecycle (`ORG_KYC_STATUSES`)
- `not_requested` - no admin has asked this office for anything (default).
- `pending` - requirements set, waiting on the founder.
- `submitted` - founder sent it in, waiting on the admin.
- `verified` - approved.
- `rejected` - sent back; the founder can fix and resubmit.

### Requirements (`RequirementSchema`, `_id: false`)
Each requirement has a `key` and `label` (required), `kind` (`"file"` for an upload or `"text"` for a typed value such as a GST number; default `"file"`), optional `description`, `required` (default `true`) and `custom` (default `false`; `false` for the built-ins, `true` for admin-typed ones).

### Submissions (`SubmissionSchema`, has its own `_id`)
One row per submitted proof, linked to a requirement by `requirementKey`.
- File proofs set `s3Key` (an object key in the **private** KYC S3 bucket), `filename`, `mimeType`, `size`.
- Text proofs set `textValue`.
- `uploadedBy` (ref `User`), `uploadedAt` (default now), per-item `status` (`pending` / `approved` / `rejected`, default `pending`), `reviewNote`, `reviewedAt`, `reviewedBy` (ref `GarageAdmin`).

### Top-level document
`orgId` (ref `Organization`, required, unique, indexed), `status` (enum above, indexed), `requirements[]`, `submissions[]`, `reviewNote` (admin's message to the founder explaining a rejection), plus audit timestamps and actors: `requestedAt`/`requestedBy` (admin), `submittedAt`, `reviewedAt`/`reviewedBy` (admin), `verifiedAt`. `timestamps: true`.

The model is registered with a `mongoose.models.OrgKyc ||` guard.

## Exports
- `ORG_KYC_STATUSES` - readonly tuple of the five statuses.
- `OrgKycStatus` - union type of those statuses.
- `OrgKycRequirementKind` - `"file" | "text"`.
- `OrgKycSubmissionStatus` - `"pending" | "approved" | "rejected"`.
- `IOrgKycRequirement`, `IOrgKycSubmission`, `IOrgKyc` - TypeScript interfaces for the requirement, submission and document.
- `OrgKyc` - the Mongoose model.

## Interfaces
- **Database:** `OrgKyc` (collection `orgkycs`). The derived mirror is written to `Organization.kycStatus` / `kycVerifiedAt` by `syncOrgKycMirror` in the service.
- **External services:** AWS S3 (private KYC bucket) holds the uploaded files referenced by `s3Key`; this model stores only the key.

## Dependencies
- **Packages:** `mongoose`.

## Used by
- `server/services/orgKyc.service.ts` - `DEFAULT_KYC_REQUIREMENTS`, `normalizeRequirements`, `getOrCreateOrgKyc`, `requirementsSatisfied`, `missingRequirements`, `syncOrgKycMirror`, `serializeOrgKyc`.
- `server/routes/orgKyc.ts` - founder-facing routes, mounted at `/org-kyc` (browser `/backend/org-kyc`).
- `server/routes/garageAdminOrgKyc.ts` - admin review routes, mounted under `/garage-admin` (browser `/backend/garage-admin/...`).

## Notes
- Treat `Organization.kycStatus` as a cache; this collection is the source of truth. Offices created before KYC existed have no `OrgKyc` row and no `kycStatus`, which both read as "not requested".
- `s3Key` points at sensitive identity documents; serve them only through signed, admin/founder-authorised access.
