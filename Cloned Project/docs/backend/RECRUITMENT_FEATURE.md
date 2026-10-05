# Recruitment Tab — Feature Documentation

Teamforce's Recruitment tab lets founders / Teamforce admins / people-managers raise job openings ("Recruitment Requests"), route them through an approval workflow, build a custom application form, share a public job landing page, and manage incoming candidates through a pipeline.

---

## 1. High-Level Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                       RECRUITMENT REQUEST LIFECYCLE                      │
└──────────────────────────────────────────────────────────────────────────┘

  Create (draft) ──► submit ──► approval_pending ──► approve ──► approved
                                                                    │
                                                                    ▼
                                                       Share Job (opens modal)
                                                                    │
                                                         On successful share
                                                                    ▼
                                                                floated
                                                                    │
                                                                    ▼
                                                                  closed

            ┌──────────────────────┐      (public URL)    ┌─────────────────┐
  approved ─► Application Form     │   ───────────────►   │ Job Landing Page│
             Builder (draft/pub)   │                      │ /jobs/:id       │
             ────────────────────  │                      └─────────────────┘
                                                                    │
                                                         Candidate applies
                                                                    ▼
                                                        TeamforceCandidate
                                                        (stage: "applied")
                                                                    │
                                                                    ▼
                             stage pipeline: applied → reviewing → shortlisted
                             → interview → offer → hired | rejected
```

---

## 2. Backend

### 2.1 Collections (MongoDB models)

#### NEW collections

**`teamforcerecruitmentrequests`**
- File: [src/models/teamforce/teamforceRecruitmentRequest.model.ts](src/models/teamforce/teamforceRecruitmentRequest.model.ts)
- Purpose: One document per job opening. Holds position details, JD, workflow status, and both draft + published custom-field definitions for the application form.

**`teamforcecandidates`**
- File: [src/models/teamforce/teamforceCandidate.model.ts](src/models/teamforce/teamforceCandidate.model.ts)
- Purpose: One document per applicant. Snapshots the position at apply-time, stores resume S3 key + metadata, pipeline stage, and answers to any published custom fields (text/number values or S3 file keys for upload fields).

#### REUSED collections

**`teamforceemployeeprofiles`**
- File: [src/models/teamforce/teamforceEmployeeProfile.model.ts](src/models/teamforce/teamforceEmployeeProfile.model.ts)
- Purpose: Consulted by `hasRecruitmentAccess()` to check `teamforceRole === "admin"` or `managesTeam === true`. Not written to by this feature.

**`organizations`**
- File: [src/models/organization.model.ts](src/models/organization.model.ts)
- Purpose: Every recruitment request / candidate is scoped to an `orgId`.

**`users`**
- File: [src/models/user.model.ts](src/models/user.model.ts)
- Purpose: `createdBy` on a request refers to a user; request authorisation uses the JWT-embedded user.

**`teamforcebranches`**
- File: [src/models/teamforce/teamforceBranch.model.ts](src/models/teamforce/teamforceBranch.model.ts)
- Purpose: Populates the "Branch" dropdown in the create/edit request form.

**`teamforcedepartments`**
- File: [src/models/teamforce/teamforceDepartment.model.ts](src/models/teamforce/teamforceDepartment.model.ts)
- Purpose: Populates the "Department" dropdown in the create/edit request form.

#### `teamforcerecruitmentrequests` schema (summary)

- Position: `positionName`, `department`, `branch`, `reportingManager`, `employmentType`, `numberOfOpenings`, `experienceRequired`, `jobLocation`, `expectedJoiningDate`
- JD: `roleSummary`, `keyResponsibilities`, `requiredSkills`, `preferredSkills`
- Approval: `approver`
- Workflow: `status` ∈ `draft | approval_pending | approved | floated | closed`
- Custom fields: `customFieldsDraft[]`, `customFieldsPublished[]` — each a `{ id, label, type: "text"|"number"|"upload", required }` sub-doc
- Meta: `createdBy`, `isActive`, `createdAt`, `updatedAt`

#### `teamforcecandidates` schema (summary)

- Snapshot: `positionName`, `department`, `jobLocation` (copied at apply time; immune to later request edits)
- Applicant: `fullName`, `mobileNumber`, `email`, `yearsOfExperience`, `experienceDetails`, `currentCtc`, `expectedCtc`, `noticePeriod`
- Resume: `resumeKey` (S3), `resumeFileName`, `resumeContentType`, `resumeSize`
- `customFieldValues[]` — one entry per published field. For upload fields: `fileKey`, `fileName`, `fileContentType`, `fileSize`. For text/number: `value: string`.
- Pipeline: `stage` ∈ `applied | reviewing | shortlisted | interview | offer | hired | rejected`, `notes`
- `isActive` (soft delete)

### 2.2 Routes

All routes mounted under `/teamforce/*` via [src/routes/teamforce/index.ts](src/routes/teamforce/index.ts).

#### NEW route files

**`/teamforce/recruitment-requests`**
- File: [src/routes/teamforce/recruitmentRequests.ts](src/routes/teamforce/recruitmentRequests.ts)
- Endpoints:
  - `GET /public/:id` — unauthenticated; trimmed payload (no `createdBy`, `approver`, `customFieldsDraft`). Used by the public landing page.
  - `GET /` — paginated list, filters by `status`.
  - `GET /:id` — single request.
  - `POST /` — create; accepts `action: "draft" | "submit"` → sets status to `draft` or `approval_pending`.
  - `PATCH /:id` — partial update. Also performs workflow transitions via `action: "submit"|"draft"` or explicit `status` (founder/admin approving/floating/closing).
  - `DELETE /:id` — soft delete (`isActive: false`).
  - `GET /:id/form` — both draft + published custom field lists.
  - `PUT /:id/form/draft` — persist the working draft list.
  - `POST /:id/form/publish` — copy `customFieldsDraft` → `customFieldsPublished`.
  - `GET /meta/access` — tells frontend if the signed-in user can see the Recruitment menu item.

**`/teamforce/candidates`**
- File: [src/routes/teamforce/candidates.ts](src/routes/teamforce/candidates.ts)
- Endpoints:
  - `POST /:requestId/apply` — authed apply. Uses `multer.memoryStorage()` + `upload.any()` so the fixed `resume` and any `customField_<id>` files are captured.
  - `POST /public/:requestId/apply` — unauth; mirrors the authed route but uses `request.orgId` for org context and the literal `"public"` as the S3 userId prefix. Only allowed if the recruitment request is `isActive`.
  - `GET /` — paginated list with optional `requestId` / `stage` filters.
  - `GET /:id/resume` — presigned URL (1 hour) for the candidate's resume.
  - `GET /:id/custom-file/:fieldId` — presigned URL for a custom-upload field's answer file.
  - `PATCH /:id` — change `stage` or `notes`.
  - `DELETE /:id` — soft delete.

#### REUSED / extended backend files

**`src/routes/teamforce/_helpers.ts`** (extended)
- File: [src/routes/teamforce/_helpers.ts](src/routes/teamforce/_helpers.ts)
- Purpose: Added `hasRecruitmentAccess()` and `requireRecruitmentAccess()` — allow founder / Teamforce admin / `managesTeam === true` employees.

**`src/middleware/auth.ts`** (reused)
- File: [src/middleware/auth.ts](src/middleware/auth.ts)
- Purpose: JWT auth middleware used on every authed endpoint.

**`src/services/s3.ts`** (reused)
- File: [src/services/s3.ts](src/services/s3.ts)
- Purpose: `s3Service.generateFileKey`, `uploadFile`, `getPresignedDownloadUrl` — used for resumes and custom-upload answer files.

### 2.3 Access control

```
hasRecruitmentAccess(req):
    founder                                → true
    teamforceRole === "admin"              → true
    managesTeam === true                   → true
    otherwise                              → false
```

Applied via `requireRecruitmentAccess(req, res)` on every authed recruitment endpoint except `GET /meta/access` (which is itself the access-probe).

---

## 3. Frontend

### 3.1 File layout

#### NEW frontend files

**`RecruitmentSection.tsx`**
- File: `components/dashboard/inlineApps/teamforce/sections/RecruitmentSection.tsx`
- Purpose: The whole in-app Recruitment tab — list, create/edit, detail, form builder, landing-page preview, in-app apply, share modal, pipeline, candidate detail view. One file, multiple view components switched by a `view` state machine.

**`app/jobs/[id]/page.tsx`**
- File: `app/jobs/[id]/page.tsx`
- Purpose: Next.js route segment for the public job landing page. Wraps the client component in a `<Suspense>` boundary.

**`app/jobs/[id]/JobLandingClient.tsx`**
- File: `app/jobs/[id]/JobLandingClient.tsx`
- Purpose: Public client component. Fetches `/teamforce/recruitment-requests/public/:id`, renders the job details and the public application form, submits to `/teamforce/candidates/public/:id/apply`.

#### REUSED / extended frontend files

**`teamforce/api.ts`** (extended)
- File: `components/dashboard/inlineApps/teamforce/api.ts`
- Purpose: Added `listRecruitmentRequests`, `getRecruitmentRequest`, `createRecruitmentRequest`, `updateRecruitmentRequest`, `deleteRecruitmentRequest`, `getRecruitmentAccess`, `getRecruitmentForm`, `saveRecruitmentFormDraft`, `publishRecruitmentForm`, `submitCandidateApplication`, `listCandidates`, `getCandidateResumeUrl`, `getCandidateCustomFileUrl`, `updateCandidateStage`.

**`teamforce/types.ts`** (extended)
- File: `components/dashboard/inlineApps/teamforce/types.ts`
- Purpose: Added `RecruitmentStatus`, `EmploymentType`, `ExperienceRange`, `CustomFieldType`, `CustomFieldDef`, `CustomFieldValue`, `RecruitmentRequest`, `RecruitmentRequestPayload`, `CandidateStage`, `Candidate`, `CandidateApplyPayload`.

**`TeamforceApp.tsx`** (reused)
- File: `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
- Purpose: Shell that mounts `RecruitmentSection` under the "Recruitment" menu entry. Uses `getRecruitmentAccess()` to decide whether the menu item renders.

### 3.2 In-app views inside `RecruitmentSection.tsx`

The top-level component holds a discriminated-union `view` state machine:

```ts
type View =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; request }
  | { kind: "view"; request }          // details page
  | { kind: "preview"; request }       // landing-page preview (in-app)
  | { kind: "apply"; request }         // in-app apply form (rarely used by admins)
  | { kind: "pipeline"; request }      // candidate pipeline for one request
  | { kind: "candidate"; request; candidate }  // one candidate's full profile
  | { kind: "configure"; request };    // Application Form Builder
```

**`list` → `RecruitmentList`**
- Grid of requests with status chips, pagination, row actions (Edit, Submit, Approve, Reject, Float, Close, Delete).

**`create` / `edit` → `RecruitmentForm`**
- Create or edit a request. Pulls branches + departments from existing Teamforce collections to populate dropdowns. Save as draft or submit for approval.

**`view` → `RecruitmentView`**
- Full detail page with action buttons: Configure Form, View Job Page, View Candidate Pipeline, Share Job.

**`preview` → `JobLandingPreview`**
- In-app replica of the public landing page (same gradient backdrop + layout). "Apply Now" jumps to the `apply` view.

**`apply` → `JobApplicationForm`**
- In-app application form (mainly used for the builder's "Preview Form" mode and admin-side test submissions). Uses the *authed* `/apply` endpoint.

**`configure` → `ApplicationFormBuilder`**
- Draft + publish the list of custom fields. Supports text / number / upload. Includes a "Preview Form" button that mounts `JobApplicationForm` with `previewFields={draft}`.

**`pipeline` → `CandidatePipelineView`**
- Stage-filtered list of candidates for a single recruitment request.

**`candidate` → `CandidateApplicationView`**
- Full read-only profile for one candidate: applicant details, resume download, custom field answers (`CustomFieldValueRow`), stage controls.

Other internal components in the same file: `ShareJobModal` (copy link + social share + embedded preview), `CustomUploadInput` (in-app upload button), `CustomFieldValueRow` (renders stored custom answers, downloads files via presigned URL).

### 3.3 Public landing page

- [app/jobs/[id]/page.tsx](../../frontend/garage-web-app-nextjs-v1/app/jobs/[id]/page.tsx) — server component with `<Suspense>`.
- [app/jobs/[id]/JobLandingClient.tsx](../../frontend/garage-web-app-nextjs-v1/app/jobs/[id]/JobLandingClient.tsx) — internal components:
  - `JobDetails` + `HeroStat` + `PreviewBlock` — read-only JD render (mirrors the in-app `JobLandingPreview`).
  - `ApplicationForm` — all fixed fields (name, mobile, email, YOE, resume, experience details, current/expected CTC, notice period) plus any published custom fields (text / number / upload).
  - `Field` / `Input` / `CustomUpload` — shared small helpers for labels, inputs, and upload buttons.

The page renders at `window.origin + /jobs/:id`. The Share Job modal copies exactly this URL.

---

## 4. End-to-end flow

### 4.1 Raise a request

1. User opens the **Recruitment** menu item — `TeamforceApp` checks `GET /teamforce/recruitment-requests/meta/access`. If `canAccess === false`, the item is hidden.
2. **List view** (`RecruitmentList`) calls `GET /teamforce/recruitment-requests?pageSize=100`.
3. User clicks **Create** → `RecruitmentForm` loads branches + departments via `GET /teamforce/branches` and `GET /teamforce/departments` (reused from existing Teamforce setup). User fills position, JD, approver. Click **Save as Draft** or **Submit for Approval** → `POST /teamforce/recruitment-requests` with `action: "draft" | "submit"`.
4. Founder / admin approves from the list row action → `PATCH /teamforce/recruitment-requests/:id` with `{ status: "approved" }`.

### 4.2 Configure the application form

1. From the request detail page, click **Configure Form** → `ApplicationFormBuilder` mounts and calls `GET /teamforce/recruitment-requests/:id/form` to load draft + published lists.
2. User adds fields (`text`, `number`, `upload`) → client-side draft array.
3. **Save Form** → `PUT /teamforce/recruitment-requests/:id/form/draft` persists `customFieldsDraft`.
4. **Publish Form** → server saves current draft, then `POST /teamforce/recruitment-requests/:id/form/publish` copies `customFieldsDraft` into `customFieldsPublished`.
5. **Preview Form** mounts `JobApplicationForm` with `previewFields={draft}` so the user can see the draft before publishing.

### 4.3 Share + float

1. From the request detail page, click **Share Job** (also triggered by the green **Float Job** action button on approved rows in the list).
2. `ShareJobModal` shows the public URL `<origin>/jobs/:id`, a copy button, four social-share tiles (LinkedIn, Twitter, Email, WhatsApp), and an inline preview with an "Open in new tab" link.
3. Successful **copy** or clicking any **social tile** fires the modal's `onShared` callback exactly once (guarded by a `useRef`).
4. The list view's `floatAfterShare` handler calls `PATCH /teamforce/recruitment-requests/:id` with `{ status: "floated" }` if the request was still `approved`.
5. "Open in new tab" on the in-modal preview deliberately does **not** fire `onShared` — it's for reviewing, not distributing.

### 4.4 Candidate applies (public)

1. Visitor lands on `/jobs/:id` → `JobLandingClient` calls `GET /teamforce/recruitment-requests/public/:id` (unauth, trimmed payload).
2. Clicks **Apply Now** → `ApplicationForm` renders. Fixed fields + any `customFieldsPublished` (text / number / upload) are shown.
3. **Submit** builds a `FormData`:
   - Fixed values as strings.
   - `resume` file under fieldname `resume`.
   - Each custom field under fieldname `customField_<id>` (File for upload type, string for text/number).
4. `POST /teamforce/candidates/public/:requestId/apply` — no auth. Backend:
   - Validates request is `isActive`.
   - Uploads resume to S3 at `cabinet/<orgId>/public/…`.
   - Iterates `customFieldsPublished`: upload fields → S3 + store `fileKey`; text/number → store `value`.
   - Creates a `TeamforceCandidate` with `stage: "applied"`.
5. UI flips to a "Thanks, application submitted" screen.

### 4.5 Review candidates

1. Request detail → **View Candidate Pipeline** → `CandidatePipelineView` calls `GET /teamforce/candidates?requestId=…&stage=…`.
2. Row click → `CandidateApplicationView` shows full profile.
3. **Download Resume** → `GET /teamforce/candidates/:id/resume` returns a 1-hour presigned S3 URL.
4. **Download custom upload answer** → `GET /teamforce/candidates/:id/custom-file/:fieldId` returns a 1-hour presigned URL.
5. Stage change → `PATCH /teamforce/candidates/:id` with `{ stage }`.

---

## 5. What's new vs reused

### Newly created

**Backend**
- Collections: `teamforcerecruitmentrequests`, `teamforcecandidates`.
- Routes: `recruitmentRequests.ts`, `candidates.ts`.
- Helpers: `hasRecruitmentAccess`, `requireRecruitmentAccess` in `_helpers.ts`.

**Frontend**
- `RecruitmentSection.tsx` — entire feature UI.
- `app/jobs/[id]/page.tsx` + `JobLandingClient.tsx` — public landing page route.

### Reused / extended

**Backend**
- `TeamforceEmployeeProfile` — read-only for access checks.
- `TeamforceBranch`, `TeamforceDepartment` — populate request form dropdowns.
- `Organization`, `User` — scoping + `createdBy`.
- `requireAuth` middleware — every authed endpoint.
- `s3Service` — resume + custom-upload file storage.

**Frontend**
- `teamforce/api.ts` and `teamforce/types.ts` — extended with recruitment types + API calls; no new module.
- `TeamforceApp.tsx` — registered the new "Recruitment" menu item; menu visibility gated by `/meta/access`.

---

## 6. File index (quick reference)

**Backend**
- [src/models/teamforce/teamforceRecruitmentRequest.model.ts](src/models/teamforce/teamforceRecruitmentRequest.model.ts)
- [src/models/teamforce/teamforceCandidate.model.ts](src/models/teamforce/teamforceCandidate.model.ts)
- [src/routes/teamforce/recruitmentRequests.ts](src/routes/teamforce/recruitmentRequests.ts)
- [src/routes/teamforce/candidates.ts](src/routes/teamforce/candidates.ts)
- [src/routes/teamforce/_helpers.ts](src/routes/teamforce/_helpers.ts)
- [src/routes/teamforce/index.ts](src/routes/teamforce/index.ts)

**Frontend (in-app)**
- `components/dashboard/inlineApps/teamforce/sections/RecruitmentSection.tsx`
- `components/dashboard/inlineApps/teamforce/api.ts`
- `components/dashboard/inlineApps/teamforce/types.ts`
- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`

**Frontend (public)**
- `app/jobs/[id]/page.tsx`
- `app/jobs/[id]/JobLandingClient.tsx`
