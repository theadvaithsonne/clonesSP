# `lib/admin-api/org-kyc.ts`

> Garage-admin client for office (organisation) KYC: the requirement catalogue, the list of every office with its KYC status, a pending count for the sidebar badge, and the review actions.

**Kind:** frontend library · **Lines:** 110

## Purpose
Admins can ask an office's founders for KYC documents, review each submission, and then verify or reject the office. Founders use `lib/org-kyc.ts`. This file is the admin side: it uses the admin JWT through `garageAdminApi` and reuses the record shapes (`OrgKycRecord`, `OrgKycRequirement`, `OrgKycStatus`) from `lib/org-kyc.ts`.

## How it works
Everything is in one object, `adminOrgKycApi`. Each method unwraps the `{ data }` response.
- `defaults()` - the built-in catalogue of requirements the picker shows.
- `list({ status?, q? })` - **every office, newest first**, including offices nobody has asked for KYC yet; those come back as `"not_requested"`. Choosing one of them is the main use of the console page.
- `pendingCount()` - the number of offices waiting for a reviewer, for the sidebar badge. It calls the list endpoint with `status=submitted` and counts the items, so no separate count endpoint is needed. The server filters by status, so this does not fetch the whole office table.
- `get(orgId)` - the full KYC record for one office.
- `setRequirements(orgId, requirements)` - replaces the list of documents the office must provide (`PUT`).
- `decideSubmission(orgId, submissionId, "approved" | "rejected", note?)` - reviews a single submission.
- `verify(orgId, note?)` / `reject(orgId, note)` - final decision for the office. A rejection needs a note.

`AdminOrgKycListItem` holds what a list row needs:
- office identity (name, slug, icon, cover photo, description, category);
- `orgLocation`, already joined server-side as "City, State, Country";
- `founder` (the first founder) and, from newer APIs, `founders` (all of them);
- status and counts, plus submitted, verified and updated timestamps.

## Exports
- `interface AdminOrgKycFounder` - `{ id, name?, email?, phone?, profilePicture? }`.
- `interface AdminOrgKycListItem` - one row of the office list (see above).
- `adminOrgKycApi` - `{ defaults, list, pendingCount, get, setRequirements, decideSubmission, verify, reject }`.

## Interfaces
- **Backend endpoints called** (`server/routes/garageAdminOrgKyc.ts`, mounted at `/garage-admin` ahead of the general admin router so its `/org-kyc/:orgId` routes take precedence):
  - `GET /backend/garage-admin/org-kyc/defaults` - requirement catalogue
  - `GET /backend/garage-admin/org-kyc?status=&q=` - office list
  - `GET /backend/garage-admin/org-kyc/:orgId` - one office's record
  - `PUT /backend/garage-admin/org-kyc/:orgId/requirements` - body `{ requirements }`
  - `POST /backend/garage-admin/org-kyc/:orgId/submissions/:submissionId/decision` - body `{ status, note }`
  - `POST /backend/garage-admin/org-kyc/:orgId/verify` - body `{ note }`
  - `POST /backend/garage-admin/org-kyc/:orgId/reject` - body `{ note }`

## Dependencies
- **Internal:** `lib/api.ts` - `garageAdminApi`; `lib/org-kyc.ts` - shared KYC types.

## Used by
- `app/garage-admin/(admin-dashboard)/kyc/page.tsx`
- `app/garage-admin/(admin-dashboard)/layout.tsx` (sidebar badge)
- `components/garage-admin/OrgKycCard.tsx`
