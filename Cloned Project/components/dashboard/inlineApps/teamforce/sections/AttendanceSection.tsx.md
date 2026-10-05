# `components/dashboard/inlineApps/teamforce/sections/AttendanceSection.tsx`

> React component `AttendanceSection`.

**Kind:** React component · **Lines:** 3989 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×16 (lucide-react), `OrgStatCard`×8 (local), `Pagination`×7 (local), `StatusCard`×7 (local), `LogIn`×6 (lucide-react), `DetailTile`×6 (local), `Clock`×5 (lucide-react), `Eye`×4 (lucide-react), `QuickAction`×4 (local), `EmployeeAttendanceView`×3 (local), `LeaveStatusBadge`×3 (local), `ChevronLeft`×3 (lucide-react), `ViewTabs`×3 (local), `Download`×3 (lucide-react), `Coffee`×3 (lucide-react), `Calendar`×3 (lucide-react), `X`×3 (lucide-react), `Check`×3 (lucide-react), `AttendanceDetailsModal`×2 (local), `ApplyLeaveModal`×2 (local), `Briefcase`×2 (lucide-react), `LogOut`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `Users`×2 (lucide-react), `TrendingUp`×2 (lucide-react), `XCircle`×2 (lucide-react), `SelfAttendanceRecordsGrid`×2 (local), `AdminAttendanceDetailsModal`×2 (local), `AdminAttendanceView` (local), `ManagerAttendanceView` (local), `Crown` (lucide-react), `Shield` (lucide-react), `UserCog` (lucide-react), `Ban` (lucide-react), `Plus` (lucide-react), `Upload` (lucide-react), `MyRecordsToggle` (local), `Filter` (lucide-react), `OrgFiltersDialog` (local)

**Hooks used:** `useState`×76, `useEffect`×14, `useCallback`×14, `useMemo`×7, `usePagination`×7 (local), `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (AttendanceSection)` | component | `AttendanceSection()` | 202 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/betty/time-tracking?orgId=${orgId}` (L397)
  - `GET /backend/betty/break-logs?orgId=${orgId}` (L400)
  - `POST /backend/betty/clock-out?orgId=${orgId}` (L708)
  - `POST /backend/betty/clock-in?orgId=${orgId}` (L723)
  - `POST /backend/betty/break-stop?orgId=${orgId}` (L748)
  - `POST /backend/betty/break-start?orgId=${orgId}` (L758)
  - `GET /backend/betty/manager-team-attendance?orgId=${orgId}&start=${encodeURIComponent(
            startIso
          )}&end=${encodeURIComponent(endIso)}` (L2258)
  - `GET /backend/betty/admin-org-attendance?orgId=${orgId}&start=${encodeURIComponent(
            startIso
          )}&end=${encodeURIComponent(endIso)}` (L3020)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L3916

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/auth.ts` — `getUserIdFromToken`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `getEmployee`, `listEmployees`, `listBranches`, `listDepartments`, `createLeaveRequest`, `listMyLeaveRequests`, `listOrgLeaveRequests`, `listTeamLeaveRequests`, … +9
  - `components/dashboard/inlineApps/teamforce/types.ts` — `EmployeeListItem`, `Branch`, `Department`, `BreakStatus`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`
  - `lucide-react` — `Plus`, `LogIn`, `LogOut`, `Clock`, `Briefcase`, `Coffee`, …
  - `xlsx`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`

## Notes

- Large file (3989 lines) — read it by section; line numbers above point into it.
