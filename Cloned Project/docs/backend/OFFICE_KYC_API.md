# Office KYC

Per-office identity verification. A garage admin picks which proofs an office
has to produce, the office founder answers them, the admin verifies.

## Storage

KYC files live in their **own private bucket** — `AWS_S3_KYC_BUCKET`
(`garage-app-kyc`), with "Block all public access" on. Nothing else in the
codebase touches that bucket, and `services/orgKycStorage.ts` never touches
`AWS_S3_BUCKET` (the general-purpose public bucket that `/upload`, cabinet,
recordings and ticket attachments still use, unchanged).

- Upload: browser asks for a presigned `PUT` (5 min TTL), uploads directly to
  S3, then POSTs the resulting key. File bytes never pass through the API.
- Read: every response mints a fresh presigned `GET` with a **10-minute** TTL.
  There is no permanent URL for a KYC document anywhere.
- Accepted: PDF, PNG, JPEG, WebP, HEIC/HEIF. Max 15 MB.
- If `AWS_S3_KYC_BUCKET` is unset the service returns 503 rather than falling
  back to the public bucket.

## Data

`models/orgKyc.model.ts` — one document per org, the source of truth.

| Status | Meaning |
| --- | --- |
| `not_requested` | No admin has asked this office for anything |
| `pending` | Requirements set — waiting on the founder |
| `submitted` | Founder sent it in — waiting on the admin |
| `verified` | Approved; the office is verified |
| `rejected` | Sent back with a note; the founder can fix and resubmit |

`Organization.kycStatus` / `kycVerifiedAt` are a derived mirror written only by
`syncOrgKycMirror()`, so listings can badge an office without a second query.

A requirement is either `kind: "file"` (upload) or `kind: "text"` (a typed
value, e.g. the GST number). Built-ins: PAN Card, Business Address Proof,
Government ID, GST Number. Admins can add any number of custom fields.

## Endpoints

### Founder (`requireAuth`, founder of the org only)

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/org-kyc/me` | Cheap nudge check for the current office. Returns `{applicable:false}` for non-founders. |
| GET | `/org-kyc/:orgId` | Full record with presigned view URLs |
| POST | `/org-kyc/:orgId/upload-url` | `{requirementKey, mimeType, sizeBytes}` → presigned PUT |
| POST | `/org-kyc/:orgId/submissions` | Record a file (`s3Key`) or a `textValue`. Replaces any earlier answer for that requirement and deletes the old object. |
| DELETE | `/org-kyc/:orgId/submissions/:id` | Remove an answer |
| POST | `/org-kyc/:orgId/submit` | Hand it to the reviewer. 400 while anything required is blank. |

### Garage admin (page-gated as `org_kyc`)

`org_kyc` is its own grantable page — holding `organizations` does not grant
it. Console page: `/garage-admin/kyc`.

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/garage-admin/org-kyc` | Office list, newest first, including offices with no KYC record (`not_requested`). `?status=`, `?q=` |
| GET | `/garage-admin/org-kyc/defaults` | Built-in requirement catalog |
| GET | `/garage-admin/org-kyc/:orgId` | Full record with presigned view URLs |
| PUT | `/garage-admin/org-kyc/:orgId/requirements` | Set the list. Dropping a requirement deletes what was uploaded for it. |
| POST | `/garage-admin/org-kyc/:orgId/submissions/:id/decision` | `{status: approved\|rejected, note?}` |
| POST | `/garage-admin/org-kyc/:orgId/verify` | 400 while a required item is missing |
| POST | `/garage-admin/org-kyc/:orgId/reject` | `{note}` — the founder sees the note |

## Verdict emails

`services/orgKycEmail.ts` mails **every founder** of the office when an admin
settles it — sent from the office's own verified domain when it has one
(`senderForOrg`), otherwise the Garage notification address.

- **Verified** → "Your office is verified", nothing further needed.
- **Rejected** → the whole-packet reason, plus a "Documents to redo" block
  listing each individually-rejected document and its own note.

Fired with `void` from the `/verify` and `/reject` handlers: the verdict is
already persisted, so a Resend outage is a missing notification, not a failed
verification. Failures are logged, never thrown.

## Frontend

- `app/garage-admin/(admin-dashboard)/kyc/page.tsx` — the console. Office list
  (newest first, status filter chips with counts, search) beside the selected
  office's packet.
- `components/garage-admin/OrgKycCard.tsx` — that packet: requirements picker,
  per-document approve/reject with a reason, verify / send back.
- `components/shared/OrgKycBanner.tsx` — founder nudge, mounted in the
  dashboard layout. Self-gating, and re-opens on every load until the packet
  is submitted or verified; closing it is never remembered.
- `components/shared/OrgKycSection.tsx` — the uploader, shared by the nudge and
  the Manage Organization popover.
