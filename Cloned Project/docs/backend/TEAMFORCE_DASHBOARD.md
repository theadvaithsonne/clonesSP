# Teamforce Dashboard — Feature Documentation

The Teamforce Dashboard (under BackOffice Apps → Teamforce → Dashboard) is a role-specific landing screen. There are three distinct views — admin/founder, manager, and employee — gated by the same role detection used elsewhere in Teamforce. All three live in the same `DashboardSection.tsx` file and share a common widget toolkit.

---

## 1. High-Level Layout

### Admin / founder — "Organization Overview"

```
  4 stat cards:  Total Employees | Total Departments | Attendance % | Pending Approvals
  Quick actions: [+ Add Employee] [+ Add Department] [✓ Approvals (N)]

  ┌──────────────────────────────────┐  ┌────────────────────────┐
  │ Employee Activity (today)        │  │ Department Distribution│
  │ Name | Dept | Status | …         │  │  (pie + branch filter) │
  │ paginated 8/page                 │  │                        │
  ├──────────────────────────────────┤  ├────────────────────────┤
  │ Attendance Trend (last 6 weeks)  │  │ Alerts & Reminders     │
  │ (line chart)                     │  │ Top 8 leaves + recruit │
  └──────────────────────────────────┘  └────────────────────────┘

  → Click "Approvals" flips to a sub-view with two paginated approval
    queues (leave + recruitment) where the user can act inline.
```

### Manager — "Your Team Overview"

```
  2 stat cards:  Attendance % | Pending Approvals
  Quick actions: [✓ Approvals] [Clock In] [Clock Out] [Take Break] [Mark Official Duty]

  ┌──────────────────────────────────┐  ┌────────────────────────┐
  │ Your Team Activity (today)       │  │ Team Alerts            │
  │ Direct reports only              │  │ Manager's bucket only  │
  ├──────────────────────────────────┤  │                        │
  │ Team Attendance Trend (6 weeks)  │  │                        │
  └──────────────────────────────────┘  └────────────────────────┘
```

### Employee — "Your Workday"

```
  4 stat cards:  Total Leaves | Leaves Taken | Upcoming Holidays | Hours Worked Today
  Quick actions: [Clock In] [Clock Out] [Take Break] [Mark Official Duty]

  ┌──────────────────────────────────────────────────────────────┐
  │ Your Daily Attendance (last 14 days)                         │
  │ Date | Login Time | Hours Worked | Attendance                │
  │ paginated 7/page                                             │
  └──────────────────────────────────────────────────────────────┘
```

---

## 2. Backend

### 2.1 Collections

This feature is **read-only over existing data** — no new collections, no schema changes, no new endpoints. All data is sourced from collections already used by other Teamforce sections.

#### REUSED collections

**`users`**
- File: [src/models/user.model.ts](src/models/user.model.ts)
- Purpose: Source of org members + roles. `User.organizations[].role` differentiates founders from stakeholders.

**`teamforceemployeeprofiles`**
- File: [src/models/teamforce/teamforceEmployeeProfile.model.ts](src/models/teamforce/teamforceEmployeeProfile.model.ts)
- Purpose: Maps each employee to a department, branch, designation, and `teamforceRole`/`managesTeam`. Drives the Department Distribution chart and the role gate.

**`teamforcebranches`**
- File: [src/models/teamforce/teamforceBranch.model.ts](src/models/teamforce/teamforceBranch.model.ts)
- Purpose: Populates the "All Branches" filter on Department Distribution.

**`teamforcedepartments`**
- File: [src/models/teamforce/teamforceDepartment.model.ts](src/models/teamforce/teamforceDepartment.model.ts)
- Purpose: Drives the Total Departments stat card and the pie chart slices (via `profile.departmentId`).

**`teamforcerecruitmentrequests`**
- File: [src/models/teamforce/teamforceRecruitmentRequest.model.ts](src/models/teamforce/teamforceRecruitmentRequest.model.ts)
- Purpose: Pending recruitment requests in the user's bucket — feeds the Pending Approvals counter, Alerts list, and the Approvals queue.

**`teamforceleaverequests`**
- File: [src/models/teamforce/teamforceLeaveRequest.model.ts](src/models/teamforce/teamforceLeaveRequest.model.ts)
- Purpose: Pending leave requests routed to the current user (per the routing rules in the leave system) — same three usages as above.

**`betty` time-tracking + break collections**
- Purpose: Today's clock-in entries for Employee Activity, and 6-week historical entries for Attendance Trend. Read via the existing `/betty/admin-org-attendance` endpoint with a 6-week date range.

### 2.2 Routes used by the dashboard

#### REUSED routes (no changes)

**`GET /teamforce/employees`**
- File: [src/routes/teamforce/employees.ts](src/routes/teamforce/employees.ts)
- Purpose: Members + Teamforce profiles (with populated `branchId`/`departmentId`) — drives Total Employees, role gate, Employee Activity, Department Distribution.

**`GET /teamforce/departments`**, **`GET /teamforce/branches`**
- Files: [src/routes/teamforce/departments.ts](src/routes/teamforce/departments.ts), [src/routes/teamforce/branches.ts](src/routes/teamforce/branches.ts)
- Purpose: Total Departments stat + branch filter dropdown.

**`POST /teamforce/departments`**
- File: same as above
- Purpose: Backs the inline "Add Department" modal opened from the dashboard quick action.

**`GET /teamforce/leave-requests?status=Pending`**
- File: [src/routes/teamforce/leaveRequests.ts](src/routes/teamforce/leaveRequests.ts)
- Purpose: Pending leaves visible to the current admin/founder (the route already filters by `approverScope` → admin_or_founder, founder_only for founders, and assignedApproverUserId). Used by Alerts, Pending Approvals counter, and the Approvals queue.

**`POST /teamforce/leave-requests/:id/approve` / `/:id/reject`**
- File: same
- Purpose: Action handlers for the Approvals queue.

**`GET /teamforce/recruitment-requests?status=approval_pending`**
- File: [src/routes/teamforce/recruitmentRequests.ts](src/routes/teamforce/recruitmentRequests.ts)
- Purpose: Pending recruitment requests for the user's bucket. Used by Alerts, Pending Approvals counter, and the Approvals queue.

**`PATCH /teamforce/recruitment-requests/:id`**
- File: same
- Purpose: Approve (`status: "approved"`) or reject (`status: "draft"`) from the Approvals queue. The route enforces approve-gating against the `approvers[]` list — only named approvers may approve when the list is non-empty.

**`GET /betty/admin-org-attendance?orgId=…&start=…&end=…`**
- Purpose: One call covering the last 6 weeks. Returns time entries + break logs. Today's slice powers Employee Activity; the full range powers Attendance Trend.

**`GET /betty/manager-team-attendance?orgId=…&start=…&end=…`**
- Purpose: Same shape as the admin endpoint but scoped to the caller's direct reports. Drives the manager's Team Activity + Team Attendance Trend.

**`GET /betty/time-tracking?orgId=…`** / **`GET /betty/break-logs?orgId=…`**
- Purpose: Personal clock entries + break logs for the caller. Drives the manager's and employee's clock/break button states and the employee's Daily Attendance table + Hours Worked Today stat.

**`POST /betty/clock-in` / `clock-out` / `break-start` / `break-stop`**
- Purpose: Backs the per-user clock and break Quick Action buttons on the manager and employee dashboards.

**`GET /teamforce/leave-requests/mine`** (`listMyLeaveRequests`)
- Purpose: Drives the employee's Total Leaves / Leaves Taken / Upcoming Holidays counters and the "On Leave" rows of Daily Attendance.

**`GET /teamforce/leave-requests/team`** (`listTeamLeaveRequests`)
- Purpose: Manager's pending-leave bucket (already filtered server-side to leaves where `assignedApproverUserId === me`).

**`GET /teamforce/leave-policies`**
- Purpose: Drives the employee's Total Leaves stat (sum of `annualQuota` across active policies).

---

## 3. Frontend

### 3.1 File layout

#### NEW frontend files

**`DashboardSection.tsx`** (full rewrite)
- File: `components/dashboard/inlineApps/teamforce/sections/DashboardSection.tsx`
- Purpose: Self-contained dashboard. Owns role gating, all data fetching, all widgets (stat cards, quick actions, Employee Activity, Attendance Trend, Department Distribution, Alerts), the Approvals sub-view, and the inline Add Department modal. ~1100 LOC, single file.

#### REUSED frontend files (no changes)

**`TeamforceApp.tsx`**
- File: `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`
- Purpose: Mounts `DashboardSection` for the "dashboard" sidebar item. Provides the `onNavigate` callback so the dashboard can route into Add Employee.

**`api.ts`** / **`types.ts`**
- Files: `components/dashboard/inlineApps/teamforce/{api,types}.ts`
- Purpose: All data calls and types reuse what already exists — `listEmployees`, `listDepartments`, `listBranches`, `listOrgLeaveRequests`, `listRecruitmentRequests`, `createDepartment`, `approveLeaveRequest`, `rejectLeaveRequest`, `updateRecruitmentRequest`, plus the corresponding types.

**`EmployeeForm.tsx`**
- File: `components/dashboard/inlineApps/teamforce/sections/EmployeeForm.tsx`
- Purpose: Reused by the dashboard's Quick Action "Add Employee" via `onNavigate("add-employee")`. No code change for this dashboard work — but the Date-of-Joining picker fix (`[color-scheme:dark]` + `showPicker()`) was made here to ensure the calendar opens reliably.

**`AttendanceSection.tsx`** / **`RecruitmentSection.tsx`**
- Files: same paths
- Purpose: Untouched; the dashboard merely shares their endpoints. Pagination styling intentionally mirrors the AttendanceSection pattern for consistency.

**Recharts**
- Already in `package.json` (`"recharts": "^3.7.0"`); used for the pie + line charts.

### 3.2 Internal components inside `DashboardSection.tsx`

**`DashboardSection`** (default export)
- Role gate: `useAmIFounder` → if true, role = "founder". Otherwise looks up `getEmployee(myUserId)` for `teamforceRole === "admin"` or `profile.managesTeam` to classify as admin / manager / employee.
- Founder/admin → `AdminFounderDashboard`.
- Manager → `ManagerDashboard`.
- Employee → `EmployeeDashboard`.

**`AdminFounderDashboard`**
- Owns the data fetches (single `loadAll` callback running 6 parallel requests).
- Owns view state: `"dashboard"` ↔ `"approvals"`.
- Renders the header, stat cards, quick action buttons, and the two-column grid of widgets.

**Stat cards**
- `StatCard` — small color-toned card (blue / purple / green / orange) showing a value + label.
- Values: `employees.length`, `departments.length`, `attendancePct` (today's unique clock-ins ÷ employees × 100), `pendingApprovals` (sum of pending leaves + pending recruitments).

**Quick actions**
- `QuickBtn` — three buttons: Add Employee (`onNavigate("add-employee")`), Add Department (opens `AddDepartmentModal`), Approvals (flips view to the approvals sub-view, label includes the count when non-zero).

**`EmployeeActivityCard`**
- Joins `employees` with today's entries + active breaks to produce one row per employee with status: Present (clocked in today, not on break), On Break (active break), Absent (no clock-in today).
- Sorts Present → On Break → Absent. Paginated 8 rows/page using the local `usePagination` hook.

**`DeptDistributionCard`**
- Recharts `PieChart` of employees per department; uses 10 fixed colors cycled via `PIE_COLORS`.
- Branch filter dropdown — when set, filters employees to that branch before counting.

**`AttendanceTrendCard`**
- Recharts `LineChart` over last 6 weeks. Each week bucket counts unique users who clocked in inside the [start, end] interval, divided by employee count → percentage.

**`AlertsCard`**
- Combines `pendingLeaves` + `pendingReqs` into a single sorted-by-createdAt list, top 8.
- Leave items render with a clock icon (yellow); recruitment items render with a file icon (blue).

**`ApprovalsView`** (sub-route)
- Two paginated tables — Leave Approvals and Recruitment Requests — each row with Approve/Reject icon buttons.
- Approve/reject calls reuse `approveLeaveRequest` / `rejectLeaveRequest` / `updateRecruitmentRequest`.
- After any action the parent's `loadAll` re-runs via `onUpdated` → `setRefreshKey(k => k+1)`.
- Backend error messages are JSON-parsed and surfaced in the toast (e.g. "Only the designated approver(s) can approve this request").

**`AddDepartmentModal`**
- Inline modal — name (required) + description fields → calls the existing `createDepartment` API.
- Behaviour mirrors the modal inside `DepartmentsSection` so the user gets the same UX as creating from Teamforce → Departments → Add Department.

**`ManagerDashboard`**
- Owns the manager's data fetches in one `loadAll` callback: `listEmployees` (filtered to `profile.reportingManagerId === me`), `/betty/manager-team-attendance` (last 6 weeks), `listTeamLeaveRequests("Pending")`, `listRecruitmentRequests({status:"approval_pending"})` filtered client-side to requests where the manager's name appears in `approvers[]` (or legacy `approver`), plus the manager's own `/betty/time-tracking` and `/betty/break-logs` for clock-button state.
- Renders 2 stat cards (Attendance %, Pending Approvals) + 5 quick actions (Approvals, Clock In, Clock Out, Take Break / Stop Break, Mark Official Duty placeholder).
- Reuses `EmployeeActivityCard` (with title="Your Team Activity"), `AttendanceTrendCard` (title="Team Attendance Trend"), `AlertsCard` (title="Team Alerts"), and the same `ApprovalsView` sub-route used by admin/founder.
- Disabled-state rules on quick actions: Clock In disabled when already clocked in, Clock Out disabled when not clocked in, Break disabled until clocked in, all inputs disabled while busy.

**`EmployeeDashboard`**
- Owns the employee's data fetches in one `loadAll` callback: `/betty/time-tracking`, `/betty/break-logs`, `listMyLeaveRequests`, `listLeavePolicies`.
- Renders 4 stat cards: Total Leaves (sum of `annualQuota` across active policies), Leaves Taken (total days across approved leaves, half-day = 0.5), Upcoming Holidays (approved leaves with `startDate >= today`), Hours Worked Today (sum of today's clock-in durations).
- 4 quick actions (Clock In, Clock Out, Take Break / Stop Break, Mark Official Duty) — same disabled rules as manager.
- "Your Daily Attendance" table — 14 most recent days. Each row's status: Present (clocked in), On Leave (date inside any approved leave range), Absent (no entry, no leave). Paginated 7 rows/page.

**`usePagination` + `Pagination`**
- Local hook + small Pagination component, identical shape to the one in AttendanceSection (Previous / Page x of y / Next, hidden when total ≤ pageSize).

**Shared widget toolkit** (used across all three dashboards)
- `StatCard` — color-toned card. Tone palette extended for the employee view: `blue / purple / green / orange / indigo / pink / teal / cyan`.
- `QuickBtn` — quick-action pill with optional `disabled` prop.
- `EmployeeActivityCard`, `AttendanceTrendCard`, `AlertsCard` — accept optional `title` / `subtitle` overrides so the same component renders both org-wide and team-scoped variants.
- `parseErr` — JSON-parses backend error bodies so toast text shows the actual message (e.g. "Only the designated approver(s) can approve this request").

### 3.3 Role-based behaviour

#### Founder / Admin

- Full org-wide dashboard with live data.
- Pending Approvals counter sums leaves + recruitment requests visible to them (per the leave-routing scope rules and recruitment access).
- Approve action on recruitment is gated server-side: if the request has named approvers, only they can approve.

#### Manager

- Team-scoped dashboard.
- Pending Approvals = pending leaves where the manager is the assigned approver + pending recruitment requests where the manager's name appears in `approvers[]`.
- Personal Clock In / Clock Out / Take Break buttons act on the manager's own attendance (same per-user endpoints used by employees).
- Approvals queue uses the same `ApprovalsView` component; backend permission checks remain the source of truth.

#### Employee

- Personal "Your Workday" dashboard.
- Stats are derived from the employee's own leaves + attendance — no team or org context.
- Same Clock In / Out / Break Quick Action buttons as manager; "Mark Official Duty" is a placeholder (toast).
- "Your Daily Attendance" merges clock entries with approved leave dates so leave days are correctly labelled "On Leave" rather than "Absent".

---

## 4. End-to-end flow

### 4.1 Initial load

1. User navigates to BackOffice Apps → Teamforce → Dashboard.
2. `DashboardSection` mounts. Role gate runs: `useAmIFounder` → if false, `getEmployee(myUserId)` → role = founder / admin / manager / employee.
3. Founder/admin path: `AdminFounderDashboard` mounts and fires six parallel API calls — `listEmployees`, `listDepartments`, `listBranches`, `/betty/admin-org-attendance` (last 42 days), `listOrgLeaveRequests("Pending")`, `listRecruitmentRequests({status:"approval_pending"})`.
4. Once all six resolve, the four stat cards, three quick-action buttons, and four widgets render.

### 4.2 Add Employee

1. Click "Add Employee" → `onNavigate("add-employee")` → `TeamforceApp` flips internal sub-route to `add-employee` → renders existing `EmployeeForm` with mode="add".
2. Same flow as Teamforce → Employees → Add Employee.

### 4.3 Add Department

1. Click "Add Department" → `AddDepartmentModal` opens inline.
2. User enters name (required) + optional description → POST `/teamforce/departments` (existing endpoint).
3. On success → modal closes, parent `refreshKey` bumps, `loadAll` re-runs → Total Departments stat and Department Distribution chart pick up the new department.

### 4.4 Approvals

1. Click "Approvals (N)" → AdminFounderDashboard flips internal `view` to `"approvals"` → `ApprovalsView` renders.
2. Two paginated tables — leaves + recruitment requests in the user's bucket.
3. Approve / reject action:
   - **Leave**: `POST /teamforce/leave-requests/:id/approve` (or `/reject`). The leave route checks `approverScope` and `assignedApproverUserId` against the caller — admins/founders may decide `admin_or_founder` scope, founders only may decide `founder_only`, only the assigned user may decide `user` scope.
   - **Recruitment**: `PATCH /teamforce/recruitment-requests/:id` with `{ status: "approved" }` or `{ status: "draft" }` for reject. Backend approve-gate verifies the caller's `User.name` is in the request's `approvers[]` (or legacy `approver`); empty list = anyone with recruitment access may approve.
4. On success/failure, toast shows the result; on success `loadAll` reruns so the queue, the count badge, and the alerts list all refresh.
5. "Back to Dashboard" button returns to the main view.

### 4.5 Department Distribution branch filter

1. Default = "All Branches".
2. User selects a specific branch → the underlying `useMemo` filters employees by `profile.branchId` → recomputes the dept counts → pie + legend re-render.

### 4.6 Attendance Trend

1. The 6-week date range is computed at mount; entries are bucketed into six 7-day windows.
2. Each window's value = `unique_clockin_userIds / total_employees * 100` rounded to nearest integer.
3. Recharts LineChart with `domain={[0, 100]}`.

### 4.7 Alerts & Reminders

1. Combines pending leaves + pending recruitment requests into one alert list.
2. Sorted by `createdAt` desc; top 8 shown.
3. Leave items show requester name + leave type; recruitment items show position + department.

---

## 5. What's new vs reused

### Newly created

**Frontend**
- `DashboardSection.tsx` — the entire dashboard implementation: role gate + `AdminFounderDashboard` + `ManagerDashboard` + `EmployeeDashboard` + the inline Approvals sub-view + Add Department modal + shared widget toolkit (StatCard, QuickBtn, EmployeeActivityCard, AttendanceTrendCard, DeptDistributionCard, AlertsCard, ApprovalsView, AddDepartmentModal, usePagination, Pagination).

### Reused / extended

**Backend**
- Zero changes — every collection and route was already in place from prior features (Recruitment, Leave Routing, Attendance, Departments).

**Frontend**
- `TeamforceApp.tsx` — already wired to mount DashboardSection for the "dashboard" sidebar item; only the internal section was rewritten.
- `api.ts` / `types.ts` — every API call and type is reused.
- `EmployeeForm.tsx` — reused via the Add Employee quick action (received only an unrelated date-picker fix during this work).
- Recharts — already a dependency.

---

## 6. File index (quick reference)

**Backend** (no changes — all reused)
- [src/routes/teamforce/employees.ts](src/routes/teamforce/employees.ts)
- [src/routes/teamforce/departments.ts](src/routes/teamforce/departments.ts)
- [src/routes/teamforce/branches.ts](src/routes/teamforce/branches.ts)
- [src/routes/teamforce/leaveRequests.ts](src/routes/teamforce/leaveRequests.ts)
- [src/routes/teamforce/recruitmentRequests.ts](src/routes/teamforce/recruitmentRequests.ts)
- [src/models/teamforce/teamforceEmployeeProfile.model.ts](src/models/teamforce/teamforceEmployeeProfile.model.ts)
- [src/models/teamforce/teamforceLeaveRequest.model.ts](src/models/teamforce/teamforceLeaveRequest.model.ts)
- [src/models/teamforce/teamforceRecruitmentRequest.model.ts](src/models/teamforce/teamforceRecruitmentRequest.model.ts)

**Frontend**
- `components/dashboard/inlineApps/teamforce/sections/DashboardSection.tsx` (new content)
- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx` (host)
- `components/dashboard/inlineApps/teamforce/api.ts` / `types.ts` (reused)
- `components/dashboard/inlineApps/teamforce/sections/EmployeeForm.tsx` (linked via Add Employee)
