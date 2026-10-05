# `components/dashboard/inlineApps/teamforce/sections/DashboardSection.tsx`

> React component `DashboardSection`.

**Kind:** React component · **Lines:** 2713 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×10 (lucide-react), `StatCard`×10 (local), `QuickBtn`×9 (local), `OutlineActionBtn`×8 (local), `Pagination`×6 (local), `CenterLoader`×3 (local), `LogIn`×2 (lucide-react), `LogOut`×2 (lucide-react), `Coffee`×2 (lucide-react), `Briefcase`×2 (lucide-react), `ApprovalsView`×2 (local), `EmployeeActivityCard`×2 (local), `Plus`×2 (lucide-react), `ResponsiveContainer`×2 (recharts), `ApprovalAvatar`×2 (local), `EmployeeDashboard` (local), `ManagerDashboard` (local), `AdminFounderDashboard` (local), `CheckSquare` (lucide-react), `AttendanceTrendCard` (local), `AlertsCard` (local), `LayoutGrid` (lucide-react), `Landmark` (lucide-react), `Calendar` (lucide-react), `Settings` (lucide-react), `DeptDistributionCard` (local), `AddDepartmentModal` (local), `ChevronDown` (lucide-react), `Search` (lucide-react), `Check` (lucide-react), `SearchableDropdown` (local), `PieChart` (recharts), `Pie` (recharts), `Cell` (recharts), `LineChart` (recharts), `CartesianGrid` (recharts), `XAxis` (recharts), `YAxis` (recharts), `Tooltip` (recharts), `Line` (recharts), … +6 more

### Props

- **`DashboardSection`**: `onNavigate: (section: Section) => void`

**Hooks used:** `useState`×42, `useMemo`×18, `useEffect`×6, `usePagination`×4 (local), `useCallback`×3, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DashboardSection)` | component | `DashboardSection({ onNavigate }: Props)` | 232 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/betty/time-tracking?orgId=${orgId}` (L295)
  - `GET /backend/betty/break-logs?orgId=${orgId}` (L301)
  - `POST /backend/betty/clock-${action === "in" ? "in" : "out"}?orgId=${orgId}` (L453)
  - `POST /backend/betty/${ep}?orgId=${orgId}` (L484)
  - `GET /backend/betty/manager-team-attendance?orgId=${orgId}&start=${encodeURIComponent(
              startIso,
            )}&end=${encodeURIComponent(endIso)}` (L715)
  - `GET /backend/betty/admin-org-attendance?orgId=${orgId}&start=${encodeURIComponent(
              startIso,
            )}&end=${encodeURIComponent(endIso)}` (L1046)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `lib/auth.ts` — `getUserIdFromToken`
  - `lib/api.ts` — `api`
  - `components/dashboard/inlineApps/teamforce/api.ts` — `listEmployees`, `listDepartments`, `listBranches`, `getEmployee`, `createDepartment`, `listOrgLeaveRequests`, `listTeamLeaveRequests`, `listMyLeaveRequests`, … +6
  - `components/dashboard/inlineApps/teamforce/types.ts` — `Section`, `EmployeeListItem`, `Department`, `Branch`, `RecruitmentRequest`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useRef`, `useState`, `ReactNode`
  - `lucide-react` — `Loader2`, `LayoutGrid`, `Landmark`, `Calendar`, `Settings`, `Plus`, …
  - `sonner` — `toast`
  - `recharts` — `PieChart`, `Pie`, `Cell`, `ResponsiveContainer`, `Tooltip`, `LineChart`, …

## Used by

- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx`

## Notes

- Large file (2713 lines) — read it by section; line numbers above point into it.
