# `lib/org-kyc.ts`

> Office KYC — founder-facing client and the types both sides share.

**Kind:** frontend library · **Lines:** 173

<!-- docgen:auto -->

## Purpose
Office KYC — founder-facing client and the types both sides share.

A garage admin decides which proofs an office owes (PAN card, address
proof, government ID, GST number, plus anything custom they add). The
founder answers them from Manage Organization / the KYC nudge, and the
admin verifies.

Files go straight from the browser to a PRIVATE S3 bucket with a presigned
PUT — they never pass through the API, and they are only ever read back
through short-lived presigned URLs the server mints per request.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OrgKycStatus` | type |  | 15 |
| `OrgKycRequirementKind` | type |  | 22 |
| `OrgKycRequirement` | interface |  | 24 |
| `OrgKycSubmission` | interface |  | 33 |
| `OrgKycRecord` | interface |  | 47 |
| `OrgKycNudge` | interface |  | 64 |
| `ORG_KYC_STATUS_LABEL` | const | `= { not_requested: "Not requested", pending: "Documents pending", submitted: "Under revie…` | 73 |
| `orgKycNeedsFounderAction` | function | `orgKycNeedsFounderAction(status?: OrgKycStatus): boolean` — Is there anything for this founder to do right now? | 82 |
| `fetchOrgKycNudge` | function | `fetchOrgKycNudge(): Promise<OrgKycNudge>` — Cheap status check for the current office — safe to call for anyone. | 87 |
| `fetchOrgKyc` | function | `fetchOrgKyc(orgId: string): Promise<OrgKycRecord>` | 91 |
| `submitOrgKyc` | function | `submitOrgKyc(orgId: string): Promise<OrgKycRecord>` | 95 |
| `saveOrgKycText` | function | `saveOrgKycText(orgId: string, requirementKey: string, textValue: string): Promise<OrgKycRecord>` | 99 |
| `deleteOrgKycSubmission` | function | `deleteOrgKycSubmission(orgId: string, submissionId: string): Promise<OrgKycRecord>` | 110 |
| `uploadOrgKycFile` | function | `async uploadOrgKycFile(orgId: string, requirementKey: string, file: File): Promise<OrgKycRecord>` — Presign → PUT to S3 → record the key. | 124 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/org-kyc/me` (L88)
  - `GET /backend/org-kyc/${orgId}` (L92)
  - `POST /backend/org-kyc/${orgId}/submit` (L96)
  - `POST /backend/org-kyc/${orgId}/submissions` (L104)
  - `DELETE /backend/org-kyc/${orgId}/submissions/${submissionId}` (L114)
  - `POST /backend/org-kyc/${orgId}/upload-url` (L129)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
- **Packages:** none

## Used by

- `app/garage-admin/(admin-dashboard)/kyc/page.tsx`
- `app/garage-admin/(admin-dashboard)/organizations/page.tsx`
- `components/garage-admin/OrgKycCard.tsx`
- `components/shared/OrgKycBanner.tsx`
- `components/shared/OrgKycSection.tsx`
- `lib/admin-api/org-kyc.ts`
