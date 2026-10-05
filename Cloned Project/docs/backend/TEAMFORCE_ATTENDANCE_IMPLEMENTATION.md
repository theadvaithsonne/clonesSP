# Teamforce Attendance — Implementation Notes

End-to-end documentation for the Teamforce Attendance feature: break tracking, leave requests, role-based views (Employee / Manager / Admin / Founder), and pagination.

---

## 1. High-level scope

| Role | What they see |
|---|---|
| **Employee** | Clock in/out, break tracking, apply leave, view own leave history, cancel pending leaves, view own attendance records. |
| **Manager** | Everything an employee can do + team-filtered attendance for direct reports + approve/reject leaves from direct reports. |
| **Admin** | Org-wide attendance records + approve/reject all leave requests. |
| **Founder** | Identical to Admin (currently reuses `AdminAttendanceView`). |

Role detection happens on the client:
- `useAmIFounder()` hook → founder
- `getEmployee(userId).teamforceRole === "admin"` → admin
- `profile.managesTeam === true` → manager
- otherwise → employee

---

## 2. Backend changes

### 2.1 New MongoDB models

#### `src/models/teamforce/teamforceBreakLog.model.ts` (new)
**Why:** employee break tracking is separate from clock-in/out. Each break belongs to an active `TimeTracking` session.
**Fields:**
- `userId`, `orgId` (indexed refs)
- `timeTrackingId` — links each break to its parent clock-in session
- `breakStartTime`, `breakStopTime`, `durationInSeconds`
- timestamps

#### `src/models/teamforce/teamforceLeaveRequest.model.ts` (new)
**Why:** single-collection design for the full leave lifecycle. One row per request, `status` transitions drive which list it appears in (Pending → Approved / Rejected / Cancelled).
**Fields:**
- `userId`, `orgId` (indexed refs)
- `leaveType` — enum: `Casual Leave | Sick Leave | Earned Leave | Official Duty`
- `startDate`, `endDate`, `isHalfDay`
- `reason` (required), `attachmentUrl` (optional — uploaded via existing `/upload`)
- `status` — enum: `Pending | Approved | Rejected | Cancelled`
- `approverUserId`, `approverName`, `decisionNote`, `decidedAt`
- compound indexes: `(orgId, status, createdAt)` for the admin queue, `(userId, orgId, createdAt)` for per-user history.

---

### 2.2 New route: `src/routes/teamforce/leaveRequests.ts`

Mounted in `src/routes/teamforce/index.ts` at `/teamforce/leave-requests`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| `POST` | `/` | any auth user | Employee submits a new leave request (status = `Pending`). |
| `GET` | `/mine` | any auth user | Current user's own leave history. |
| `GET` | `/` | founder / admin | All leaves in org. Optional `?status=` filter. |
| `GET` | `/team` | manager | Leaves from direct reports only (uses `reportingManagerId`). Optional `?status=`. |
| `POST` | `/:id/approve` | founder / admin / that employee's manager | Approves a pending request. Stamps approver info + `decidedAt`. |
| `POST` | `/:id/reject` | same as approve | Rejects a pending request. |
| `POST` | `/:id/cancel` | the requester | Cancels own pending request. |

**Key helper functions inside the route:**
- `getTeamUserIds(userId, orgId)` — returns `ObjectId[]` of direct reports by scanning `TeamforceEmployeeProfile.reportingManagerId`.
- `isManager(userId, orgId)` — boolean based on `managesTeam` flag.
- `canDecideLeave(meUserId, orgId, leaveUserId)` — true when the current user is the `reportingManagerId` of the leave requester. Used inside `decide()` to unlock manager approvals without granting full-org admin access.

**Authorization logic** inside `decide()`:
1. If `hasFullAccess(req)` → allowed (founder or Teamforce Admin).
2. Else, look up the leave and check `canDecideLeave()`.
3. Otherwise 403.

---

### 2.3 Updates to `src/routes/betty.ts`

Two additions, both read-only aggregation endpoints. The frontend does the per-row computation; the backend just returns raw entries + break logs.

#### Break-tracking endpoints (employee-scoped)
- `POST /betty/break-start` — requires an active (non-closed) clock-in session; prevents duplicate active breaks.
- `POST /betty/break-stop` — closes the currently active break.
- `GET /betty/break-logs` — last 200 break logs for the caller.
- Also updated `POST /betty/clock-out` to auto-close any open break when the user clocks out (prevents orphan breaks).

#### Org-wide attendance
- `GET /betty/admin-org-attendance?orgId&start&end` — returns `{ entries, breakLogs }` for the entire org in the range. Access gated via `hasFounderAccess` or admin check (reused from existing logic). Frontend aggregates into one row per (user, date) pair.

#### Manager team attendance
- `GET /betty/manager-team-attendance?orgId&start&end` — same payload shape as admin-org-attendance, but filtered to the caller's direct reports (`reportingManagerId = me`). Returns `[]` for non-managers (403).

**Why two separate endpoints?** — keeps authz checks explicit and lets managers use the same frontend aggregation path without leaking the org-wide dataset.

---

### 2.4 Existing files touched

- `src/routes/teamforce/index.ts` — mounts the new `leaveRequests` router.

Nothing else backend-side changed; all other logic is additive.

---

## 3. Frontend changes

All frontend changes live in:
`components/dashboard/inlineApps/teamforce/`

### 3.1 `api.ts` — new helpers
Types exported: `LeaveType`, `LeaveStatus`, `LeaveRequest`, `LeaveRequestInput`.

New functions (all auto-scope to current org via `withOrg` helper and pass JWT via `api()`):
- `createLeaveRequest(data)`
- `listMyLeaveRequests()`
- `listOrgLeaveRequests(status?)` — admin / founder queue.
- `listTeamLeaveRequests(status?)` — manager queue.
- `approveLeaveRequest(id, note?)`
- `rejectLeaveRequest(id, note?)`
- `cancelLeaveRequest(id)`

### 3.2 `sections/AttendanceSection.tsx` — main view file

Top-level router `AttendanceSection` picks a sub-view based on role. Each sub-view is a self-contained component:

- `EmployeeAttendanceView` — clock-in/out, break buttons, apply leave modal, my leave requests grid (with cancel), my attendance records grid.
- `ManagerAttendanceView` — 4 stat cards scoped to the team, leave approval queue (team-only), team attendance records grid with department + member dropdowns.
- `AdminAttendanceView` — 4 org-wide stat cards, full leave approval queue, full attendance records grid with branch + department dropdowns, date range.
- Founder reuses `AdminAttendanceView` (the UI spec turned out to be identical to admin — no need to duplicate).

Shared at the bottom of the file:
- `usePagination<T>(data, pageSize=10)` hook — returns `{ page, totalPages, pageItems, transitioning, goNext, goPrev, total, start, end }`. Uses `safePage = min(page, totalPages)` synchronously to avoid "empty page" flicker when data shrinks, and cleans up its `setTimeout` timer on unmount.
- `Pagination` component — prev/next buttons + "Showing X–Y of N" strip. Auto-hides when `total ≤ PAGE_SIZE`.

### 3.3 Sub-components inside AttendanceSection
- `ApplyLeaveModal` — leave type dropdown, start/end date pickers (cross-linked via `min`/`max`), half-day checkbox, reason textarea, optional attachment upload (uses existing `uploadFile`).
- `LeaveStatusBadge` — color-codes `Pending / Approved / Rejected / Cancelled`.
- `AdminAttendanceDetailsModal` — per-day timeline (clock-in/out + breaks) reused by both Admin and Manager views.
- `StatusCard`, `QuickAction` — small building blocks for dashboards.

### 3.4 `TeamforceApp.tsx` — header metadata
Changed the Attendance section subtitle from `"Coming soon"` to `"Track attendance, breaks, and leave requests"` so the top navigation reflects the live feature.

---

## 4. Feature walk-through

### 4.1 Clock in/out (employee)
- UI: `EmployeeAttendanceView` → "Clock In" / "Clock Out" buttons.
- Hits `POST /betty/clock-in` and `POST /betty/clock-out` (existing endpoints).
- Collection used: **`TimeTracking`** (`src/models/timeTracking.model.ts`).

### 4.2 Break tracking (employee)
- UI: "Start Break" / "Stop Break" buttons (enabled only while clocked in).
- Hits `POST /betty/break-start` and `POST /betty/break-stop`.
- Collection used: **`TeamforceBreakLog`** with a `timeTrackingId` link to the parent session.
- On clock-out, the backend auto-closes any still-open break to prevent orphans.

### 4.3 Apply leave (employee)
- UI: `EmployeeAttendanceView` → "Apply Leave" button → `ApplyLeaveModal` overlay.
- Form submits via `createLeaveRequest()` → `POST /teamforce/leave-requests`.
- Collection used: **`TeamforceLeaveRequest`** (`status = "Pending"` on creation).
- After submit, `loadLeaves()` re-fetches `listMyLeaveRequests()` and the "My Leave Requests" grid updates.

### 4.4 Cancel pending leave (employee)
- UI: Ban icon on each pending row.
- Hits `cancelLeaveRequest(id)` → `POST /teamforce/leave-requests/:id/cancel`.
- Backend enforces `{ userId: me, status: "Pending" }` via `findOneAndUpdate`, so users can't cancel someone else's leave or a decided one.

### 4.5 Manager team attendance (manager)
- UI: `ManagerAttendanceView`.
- Two data sources per view:
  - `GET /betty/manager-team-attendance` → raw entries + breaks for direct reports.
  - `listTeamLeaveRequests("Pending")` → pending leaves from direct reports.
- Team roster is computed client-side by filtering `listEmployees()` where `profile.reportingManagerId === myUserId`.
- Filters: start date, end date, department, team member.
- Approve / reject buttons call `approveLeaveRequest` / `rejectLeaveRequest`. Backend's `canDecideLeave()` unlocks these paths for the employee's direct manager.

### 4.6 Leave approval queue (admin / founder)
- UI: `AdminAttendanceView` → top "Leave Approval Queue" table.
- Data: `listOrgLeaveRequests("Pending")`.
- Approve → `approveLeaveRequest(id)`; Reject → `rejectLeaveRequest(id)`; both re-fetch the list. Backend uses `hasFullAccess` gate.

### 4.7 Org-wide attendance records (admin / founder)
- UI: `AdminAttendanceView` → "Attendance Records" grid.
- Data: single call to `GET /betty/admin-org-attendance?orgId&start&end`.
- Client-side aggregation (in `useMemo`):
  - groups entries & breaks by `(userId, date)`.
  - fills in "Absent" rows for employees with no entry on a given date.
  - computes `Present / Half Day / Absent` plus total worked seconds and break seconds.
- Branch + department dropdowns filter employees client-side before the grouping step.

### 4.8 Pagination (all grids)
- 4 grids across 3 views: "My Leave Requests", "My Attendance", team grid, admin grid, leave approval queues.
- Client-side pagination — `usePagination(data, 10)` slices data with `useMemo`. `Pagination` component renders the chrome. Auto-hides for short lists.
- A 250ms `setTransitioning(true)` state shows a loader while page flips, so the grid doesn't flash between renders. Timer is cleaned up on unmount.

---

## 5. Data flow summary

```
 Frontend view               API helper                 Route                                 Collection
 ─────────────────────       ─────────────────────      ──────────────────────────────────    ──────────────────────────
 EmployeeAttendanceView      api /betty/clock-in|out    POST /betty/clock-{in,out}            TimeTracking
 EmployeeAttendanceView      api /betty/break-start|stop POST /betty/break-{start,stop}       TeamforceBreakLog
 ApplyLeaveModal             createLeaveRequest         POST /teamforce/leave-requests        TeamforceLeaveRequest
 EmployeeAttendanceView      listMyLeaveRequests        GET  /teamforce/leave-requests/mine   TeamforceLeaveRequest
 EmployeeAttendanceView      cancelLeaveRequest         POST /teamforce/leave-requests/:id/cancel  TeamforceLeaveRequest
 ManagerAttendanceView       api /betty/manager-team-attendance  GET /betty/manager-team-attendance  TimeTracking + TeamforceBreakLog  (filtered by reportingManagerId)
 ManagerAttendanceView       listTeamLeaveRequests      GET  /teamforce/leave-requests/team   TeamforceLeaveRequest  (filtered by reportingManagerId)
 Manager+Admin approve/reject approveLeaveRequest etc   POST /teamforce/leave-requests/:id/{approve,reject}  TeamforceLeaveRequest
 AdminAttendanceView         api /betty/admin-org-attendance  GET /betty/admin-org-attendance  TimeTracking + TeamforceBreakLog
 AdminAttendanceView         listOrgLeaveRequests       GET  /teamforce/leave-requests        TeamforceLeaveRequest
```

Employee / department / branch metadata comes from the existing teamforce routes (`listEmployees`, `listBranches`, `listDepartments`) which hit `TeamforceEmployeeProfile`, `Branch`, and `Department` collections respectively.

---

## 6. Collections used (summary)

| Collection | Used by | Purpose |
|---|---|---|
| `TimeTracking` | Employee clock-in/out, Admin/Manager attendance grids | raw clock-in/out sessions |
| `TeamforceBreakLog` *(new)* | Employee break buttons, Admin/Manager attendance grids | break session intervals |
| `TeamforceLeaveRequest` *(new)* | Apply-leave modal, leave grids, approval queues | single-collection leave lifecycle |
| `TeamforceEmployeeProfile` | Role detection, team roster, manager filters | `reportingManagerId`, `managesTeam`, `departmentId`, `branchId` |
| `User` | Approver name population | `name` on decided leaves |
| `Branch`, `Department` | Admin / Manager filters | dropdown options + row labels |

---

## 7. Things explicitly *not* added (kept simple on purpose)
- No separate founder view — identical to admin per the latest spec.
- No server-side pagination — client-side was enough given expected volumes and keeps the backend endpoints simple.
- No email / push notifications on leave decisions.
- No audit trail beyond `approverUserId`, `approverName`, `decisionNote`, `decidedAt` on the request itself.
- No leave balance tracking — the current system records requests, not quotas.

Any of the above can be added without disturbing this layer.

---

## 8. Break Policy — multiple named policies per org (added later)

Originally break settings were **one row per org** (singleton). That was replaced with **multiple named policies per org**, so admins can maintain different rules for different departments / designations side-by-side, and the system picks the most-specific one for each employee at runtime.

### 8.1 Why the change
- Old singleton model meant creating a new policy **overwrote** the existing one — admins lost the previous config.
- Real orgs want one rule for Sales, a different rule for Engineering, and a universal fallback for everyone else.
- Admins need to see a list of every policy currently in the org (like Shifts / Patterns / Leave Policy tabs already show).

### 8.2 Model: `src/models/teamforce/teamforceBreakSettings.model.ts`
- Added required `name: string` field (trimmed).
- Removed the `unique: true` on `orgId` (no more singleton).
- Added compound unique index `{ orgId: 1, name: 1 }` so two policies in the same org can't share a name, but the same name can exist across different orgs.
- Legacy `orgId_1` unique index is auto-dropped at router load (see route note below) so existing DBs upgrade transparently.

### 8.3 Route: `src/routes/teamforce/breakSettings.ts` (rewritten)
Mounted at `/teamforce/break-settings`.

One-shot at module load:
```ts
TeamforceBreakSettings.collection.dropIndex("orgId_1").catch(() => {});
```
Silently drops the old singleton index if present — safe no-op otherwise.

| Method | Path | Who | Purpose |
|---|---|---|---|
| `GET` | `/` | any auth user | List all break policies for the current org. |
| `POST` | `/` | founder / teamforce admin | Create a new policy. 409 on duplicate name. |
| `PATCH` | `/:id` | founder / teamforce admin | Update one policy by id. |
| `DELETE` | `/:id` | founder / teamforce admin | Delete one policy by id. |
| `GET` | `/status` | any auth user | Today's break budget / usage computed against the policy that applies to the caller. |

Zod validation: `policyBodySchema` (name required on create) and `policyUpdateSchema = policyBodySchema.partial()` for PATCH.

### 8.4 `findApplicablePolicy(userId, orgId)` helper
Core resolver exported for reuse by `betty.ts`. Given a user, returns the **single** policy that currently applies to them, or `null`.

Algorithm:
1. Load all policies for the org where `activateBreaks = true`.
2. Load the user's `TeamforceEmployeeProfile` (only `departmentId` + `designation`).
3. Keep only policies that match the user:
   - `Universal` → always matches.
   - `By Department` → `scopeTargets` contains `profile.departmentId`.
   - `By Designation` → `scopeTargets` contains `profile.designation`.
4. Sort matching policies by scope specificity, most-specific first:
   - `By Designation` = priority 3
   - `By Department` = priority 2
   - `Universal` = priority 1
5. Tie-break alphabetically on `name` for determinism.
6. Return the winner.

This replaced the old `isEmployeeInScope` boolean helper.

### 8.5 Updates to `src/routes/betty.ts`
- Import changed to `findApplicablePolicy` from `./teamforce/breakSettings`.
- `POST /betty/break-start` guard:
  ```ts
  const policy = await findApplicablePolicy(me.userId, orgId);
  if (!policy) return 403 "No active break policy applies to you. Ask your admin to activate one that includes your department or designation.";
  ```
- `POST /betty/break-stop` reads the daily budget from `policy?.breakMinutesPerDay` (via the same helper) instead of the singleton doc.

### 8.6 `GET /teamforce/break-settings/status`
Computed response shape (consumed by the frontend attendance view):
```ts
{
  activated: boolean,              // a policy applies at all
  inScope: boolean,                // same as activated for now — kept as separate flag for future split
  policyId: string | null,
  policyName: string | null,
  breakMinutesPerDay: number,
  budgetSeconds: number,
  usedSeconds: number,             // sum of today's closed break durations + live diff for the open one
  remainingSeconds: number,
  overBudgetSeconds: number,
  hasBreached: boolean,
  onBreak: boolean,
  breakStartTime: string | null,
}
```

Computed from `TeamforceBreakLog` rows with `breakStartTime >= startOfDay`. Open breaks contribute `(now - breakStartTime)` to `usedSeconds` so the UI counts down in real time.

### 8.7 Frontend changes

`components/dashboard/inlineApps/teamforce/types.ts`
- Renamed `BreakSettings` → `BreakPolicy`, added required `name: string`.
- `BreakStatus` gained `policyId: string | null` and `policyName: string | null`.

`components/dashboard/inlineApps/teamforce/api.ts`
- Removed: `getBreakSettings`, `updateBreakSettings`.
- Added: `listBreakPolicies`, `createBreakPolicy`, `updateBreakPolicy`, `deleteBreakPolicy`.
- Kept: `getBreakStatus`.

`components/dashboard/inlineApps/teamforce/sections/SettingsSection.tsx` — `BreakPolicyTab` rewritten to mirror `PoliciesTab` / `ShiftsTab` / `PatternsTab`:
- List-first view. "Add Break Policy" form is **hidden** until the button is clicked (matching the other settings tabs).
- Required **Name** field at the top of the form.
- Per-policy `activateBreaks` toggle (was org-wide before).
- Table below the form shows all policies with columns: **Name · Status · Applies To · Min / Day · Breach Affects Pay · Actions**.
- Edit loads the row into the form; Delete confirms then calls the DELETE route.
- Backend's 409 duplicate-name error is surfaced via `apiErrorMessage` as a toast.
- Old `BreakPolicySummary` and `SummaryRow` helpers were removed (obsolete under the list pattern). `Toggle` and `CheckRow` helpers are kept — still used by the form body.

`components/dashboard/inlineApps/teamforce/sections/AttendanceSection.tsx` (earlier change, still in force):
- `notifyBreachOncePerDay()` helper uses `localStorage` keyed by `yyyy-mm-dd` to show the "you went over your break budget" toast **exactly once per day per user**.
- Break button is disabled with an explanatory label when `status.activated === false` (no policy applies) or when the user is already on a break.
- Budget badge shows `remainingSeconds` / `overBudgetSeconds` live from `GET /teamforce/break-settings/status`.

### 8.8 Data flow

```
 Frontend                    API helper                    Route                                    Collection
 ─────────────────────       ──────────────────────        ────────────────────────────────────    ─────────────────────────
 SettingsSection (Break)     listBreakPolicies             GET  /teamforce/break-settings          TeamforceBreakSettings
 SettingsSection (Break)     createBreakPolicy             POST /teamforce/break-settings          TeamforceBreakSettings
 SettingsSection (Break)     updateBreakPolicy             PATCH /teamforce/break-settings/:id     TeamforceBreakSettings
 SettingsSection (Break)     deleteBreakPolicy             DELETE /teamforce/break-settings/:id    TeamforceBreakSettings
 AttendanceSection           getBreakStatus                GET  /teamforce/break-settings/status   TeamforceBreakSettings + TeamforceBreakLog
 AttendanceSection           api /betty/break-start|stop   POST /betty/break-{start,stop}          TeamforceBreakLog  (gated by findApplicablePolicy)
```

### 8.9 Migration notes
- Existing singleton rows keep working — they load in `listBreakPolicies`, but the new UI will flag them as unnamed in the list until the admin edits them and saves a name (Mongoose validates `name` only on write).
- The old `orgId_1` unique index is dropped automatically on the first request after deploy. No manual DB migration required.
- Frontend and backend must be deployed together: the old frontend cannot read the list-shape response, and the old backend cannot handle `POST` with a `name` field.

### 8.10 Things explicitly *not* added
- No per-user policy override — scope is always Department / Designation / Universal.
- No effective-date ranges on policies (policies are always "current").
- No audit log of who created or edited a policy.
- No bulk import / export of policies.

