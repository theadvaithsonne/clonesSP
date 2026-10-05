# Plan: Teamforce HR — Backend + Garage Web App Integration

## Context

Build a complete HR/employee management module ("Teamforce") that lives inside the garage web app's existing BackOffice → Marketplace as an inline React component (not an iframe). The backend endpoints are added to `garagenew-backend`.

**Core model:** Employees = users already in the org (from `User.organizations`). HR-specific data is layered on top via a `TeamforceEmployeeProfile` collection keyed by `(userId, orgId)`. Lookups (branches, departments, shifts, weekly-off patterns) get their own per-org collections.

**Permission tiers:**
| Role | Read directory | Edit profiles | See salary/bank/TDS | Promote admins |
|---|---|---|---|---|
| Founder | Yes | Yes | Yes | Yes |
| Teamforce Admin | Yes | Yes | Yes | No |
| Regular member | Yes | No | No | No |

`teamforceRole` lives on `TeamforceEmployeeProfile`, NOT on the Garage `User.organizations[].role`.

---

## Phase 1: Backend (garagenew-backend)

### New models — `src/models/teamforce/`

**1. `teamforceBranch.model.ts`**
- `orgId` (ref Organization), `name`, `code?`, `address?`, `city?`, `state?`, `country?`, `postalCode?`, `isActive` (default true)
- Index: `{ orgId: 1, name: 1 }` unique

**2. `teamforceDepartment.model.ts`**
- `orgId`, `name`, `description?`, `headId?` (ref User), `isActive`
- Index: `{ orgId: 1, name: 1 }` unique

**3. `teamforceShift.model.ts`**
- `orgId`, `name`, `startTime` (HH:mm), `endTime` (HH:mm), `breakMinutes`, `isActive`

**4. `teamforceWeeklyOffPattern.model.ts`**
- `orgId`, `name`, `offDays` (array of 0-6), `isActive`

**5. `teamforceEmployeeProfile.model.ts`** — the main HR layer
- `userId` (ref User), `orgId` (ref Organization) — unique compound index
- `teamforceRole`: enum `admin | member`, default `member`
- Basic: `mobileNumber`, `permanentAddress`, `currentAddress`, `sameAsPermanent`
- Joining: `dateOfJoining`, `placeOfJoining`, `branchId`, `departmentId`, `designation`, `employmentType` (full-time|part-time|contract|intern|freelance)
- Reporting: `reportingManagerId`, `secondaryReviewerId`, `managesTeam`
- Education: `[{ degreeName, yearOfPassing, certificateUrl }]`
- Experience: `[{ companyName, yearsOfExperience, designation, referenceName, referenceContact }]`
- Salary: `basicSalary`, `hra`, `transportAllowance`, `providentFund`, `professionalTax`, `variablePay`, `customAllowances[{name,amount}]`, `customDeductions[{name,amount}]`
- TDS: `tdsRegime` (new|old), `estimatedAnnualTds`, `autoCalculateTds`
- Attendance: `shiftId`, `weeklyOffPatternId`
- Documents: `offerLetterUrl`, `idProofUrl`, `educationCertificatesUrl`, `experienceLettersUrl`
- Bank: `bankAccountHolderName`, `bankAccountType` (savings|current), `bankAccountNumber`, `bankIfscCode`

### New routes — `src/routes/teamforce/`

**`_helpers.ts`**:
- `requireTeamforceWriteAccess(req, res)` — true if founder OR `teamforceRole === "admin"`
- `requireFounderOnly(req, res)` — true only if founder (for admin promotion)
- `hasFullAccess(req)` — async, returns boolean for field stripping decisions
- `stripSensitive(profile, fullAccess)` — strips salary/bank/TDS if `!fullAccess`

**`branches.ts`** — CRUD scoped by orgId (write: `requireTeamforceWriteAccess`)
**`departments.ts`** — same
**`shifts.ts`** — same
**`weeklyOffPatterns.ts`** — same

**`employees.ts`**:
- `GET /` — list org users left-joined with profiles. Strips sensitive fields unless `hasFullAccess`
- `GET /:userId` — single detail, same stripping
- `POST /` — upsert profile (find-or-create User + add org membership if needed)
- `PATCH /:userId` — update profile
- `PATCH /:userId/role` — set `teamforceRole` (**founder-only**)
- `DELETE /:userId/profile` — delete profile doc only

**`index.ts`** — compose sub-routers, export single router

### Mount — `src/app.ts`
```ts
import teamforceRoutes from "./routes/teamforce";
app.use("/teamforce", teamforceRoutes);
```

---

## Phase 2: Garage Web App Frontend

### 2a. Wire Teamforce as an inline app

**`components/dashboard/Marketplace.tsx`** (EDIT):
- Add `renderType?: "iframe" | "inline"` to CATALOG type
- Mark `teamforce` entry as `renderType: "inline"`, remove its `url`

**`components/dashboard/AppContainer.tsx`** (EDIT):
- Import `INLINE_APP_REGISTRY` from new registry file
- If `INLINE_APP_REGISTRY[id]` exists, render the component directly instead of iframe
- Accept `onClose` prop

**`app/(dashboard)/layout.tsx`** (EDIT):
- Pass `onClose={() => setActiveContainer(null)}` to `<AppContainer />`

**`components/dashboard/inlineApps/registry.ts`** (NEW):
- Dynamic import of `TeamforceApp` with `ssr: false`
- Export `INLINE_APP_REGISTRY` map and `InlineAppProps` type

### 2b. Teamforce App Shell + UI

All under `components/dashboard/inlineApps/teamforce/`.

#### Design System (matches garage dark theme)

**Colors — use ONLY the existing garage palette:**
- Background: `bg-[#0c0c0e]` (app bg) / `bg-[#1e1e2d]` (cards)
- Text: `text-white` / `text-[#9fa0b8]` (muted)
- Primary: `bg-[#fbd10d]` / `text-[#fbd10d]` (golden yellow — buttons, active states, accents)
- Borders: `border-white/10`
- Hover: `hover:bg-white/5`
- Active nav: `bg-[#111116]` with `text-white` and left border `border-l-2 border-[#fbd10d]`

**Components — reuse existing shadcn/ui:**
- `Button`, `Input`, `Select`, `Textarea`, `Dialog`, `Card`, `Badge`, `Table`, `Form` (react-hook-form), `Checkbox`, `Tabs`
- All already styled for dark theme

**Typography:**
- Section headings: `text-lg font-semibold text-white`
- Labels: `text-sm text-[#9fa0b8]`
- Values: `text-sm text-white`

**Card style:**
- `bg-[#1e1e2d] rounded-xl border border-white/10`
- No heavy shadows — `shadow-none` or `shadow-sm` at most

**Animations:**
- `transition-all duration-200` on nav items, buttons, hovers
- No framer-motion (unnecessary weight inside a popover app)

#### `TeamforceApp.tsx` — Shell

```
┌──────────────────────────────────────────────────────┐
│ ■ Teamforce HR              [org name]         [✕]  │  ← Header bar
├─────────────┬────────────────────────────────────────┤
│ Dashboard   │                                        │
│ Employees   │        Section Content Area            │
│ Departments │                                        │
│ Branches    │                                        │
│ Attendance  │                                        │
│ Payroll     │                                        │
│ Settings    │                                        │
├─────────────┴────────────────────────────────────────┤
```

- Header: `h-14 bg-[#111116] border-b border-white/10` — logo left, org name center, close button right (calls `onClose`)
- Sub-sidebar: `w-[200px] bg-[#0c0c0e] border-r border-white/10` — nav items with icons, golden-yellow left border on active
- Content: `flex-1 bg-[#0c0c0e] overflow-y-auto p-6`
- State: `useState<Section>` for switching — no routing

On mount: fetch current user's profile to determine `hasWriteAccess` (founder or admin).

#### `api.ts` — API client

Typed wrappers around existing `import { api } from "@/lib/api"`:
- `listEmployees()`, `getEmployee(userId)`, `upsertEmployee(payload)`, `updateEmployeeProfile(userId, patch)`
- `setTeamforceRole(userId, role)` → `PATCH /teamforce/employees/:userId/role`
- CRUD for `branches`, `departments`, `shifts`, `weeklyOffPatterns`
- `uploadFile(file: File)` → `POST /upload` (existing S3 endpoint)

#### `types.ts` — TypeScript interfaces

Mirror the Mongoose models: `EmployeeListItem`, `EmployeeProfile`, `Branch`, `Department`, `Shift`, `WeeklyOffPattern`, `EducationEntry`, `WorkExperienceEntry`, `CustomAmount`.

#### Section Components

**`sections/DashboardSection.tsx`**
- KPI stat cards in a 2x2 or 4-column grid: Total Employees, Departments, Branches, Admins
- Cards: `bg-[#1e1e2d] rounded-xl border border-white/10 p-5`
- Stat value: `text-3xl font-bold text-white`
- Stat label: `text-sm text-[#9fa0b8]`
- Optional accent icon per card in `text-[#fbd10d]`

**`sections/EmployeesSection.tsx`**
- Top bar: "Employees" title left + "Add Employee" button right (golden yellow, visible only if `hasWriteAccess`)
- Search input: `bg-transparent border border-white/10 rounded-lg` with search icon
- Table using shadcn `Table` component on dark bg:
  - Columns: Avatar (initials circle), Name, Email, Department, Role badge, Teamforce Role badge, Joined
  - Row hover: `hover:bg-white/5`
  - Avatar: gradient colored circle with initials, `rounded-full h-8 w-8`
  - Role badges: `Badge` component — "Founder" gold, "Admin" blue, "Member" gray
  - "Make Admin" / "Remove Admin" action in row dropdown (visible only to founders via `useAmIFounder`)
- Click row → opens `EmployeeDetailPanel` (slide-in or inline expand)

**`sections/EmployeeForm.tsx`**
- Full-page form inside the content area, scrollable
- Sectioned with headings + dividers (matching the screenshots): Basic & Personal, Joining & Organization, Reporting & Hierarchy, Education, Work Experience, Salary Structure, Tax Configuration, Attendance & Policy, Document Uploads, Bank Account Details
- Section headings: `text-base font-semibold text-white border-b border-white/10 pb-2 mb-4`
- Form grid: `grid grid-cols-2 gap-x-6 gap-y-4` for two-column layout
- Inputs: shadcn `Input` (already dark-themed), `Select`, `Textarea`
- Labels: `text-sm font-medium text-[#9fa0b8]` with red `*` for required
- Repeatable sections (Education, Work Experience): "Add Another" button in `text-[#fbd10d]` with + icon
- Custom Allowances/Deductions: dynamic rows with name + amount inputs and delete button
- File upload fields: styled upload button → calls `uploadFile()` → shows filename + checkmark when done
- Salary/TDS/Bank sections hidden if `!hasWriteAccess`
- Bottom: "Save Employee" golden button + "Cancel" ghost button
- Uses react-hook-form (already available in the project via `components/ui/form.tsx`)

**`sections/BranchesSection.tsx`**
- Simple card-based list or table of branches
- "Add Branch" button → opens shadcn `Dialog` with form (name, code, city, state, country)
- Edit/delete via row actions (dropdown or inline buttons)
- All CRUD gated by `hasWriteAccess`

**`sections/DepartmentsSection.tsx`** — same pattern as branches

**`sections/AttendanceSection.tsx`** — stub: card with "Coming Soon" message, muted icon
**`sections/PayrollSection.tsx`** — stub
**`sections/SettingsSection.tsx`** — stub (future: shift management, weekly-off patterns)

---

## Critical files

**Backend (garagenew-backend):**
- `src/models/teamforce/teamforceBranch.model.ts` — NEW
- `src/models/teamforce/teamforceDepartment.model.ts` — NEW
- `src/models/teamforce/teamforceShift.model.ts` — NEW
- `src/models/teamforce/teamforceWeeklyOffPattern.model.ts` — NEW
- `src/models/teamforce/teamforceEmployeeProfile.model.ts` — NEW
- `src/routes/teamforce/index.ts` — NEW
- `src/routes/teamforce/_helpers.ts` — NEW
- `src/routes/teamforce/branches.ts` — NEW
- `src/routes/teamforce/departments.ts` — NEW
- `src/routes/teamforce/shifts.ts` — NEW
- `src/routes/teamforce/weeklyOffPatterns.ts` — NEW
- `src/routes/teamforce/employees.ts` — NEW
- `src/app.ts` — 2-line edit

**Frontend (garage-web-app-nextjs-v1):**
- `components/dashboard/Marketplace.tsx` — EDIT
- `components/dashboard/AppContainer.tsx` — EDIT
- `app/(dashboard)/layout.tsx` — EDIT (1 line)
- `components/dashboard/inlineApps/registry.ts` — NEW
- `components/dashboard/inlineApps/teamforce/TeamforceApp.tsx` — NEW
- `components/dashboard/inlineApps/teamforce/api.ts` — NEW
- `components/dashboard/inlineApps/teamforce/types.ts` — NEW
- `components/dashboard/inlineApps/teamforce/sections/DashboardSection.tsx` — NEW
- `components/dashboard/inlineApps/teamforce/sections/EmployeesSection.tsx` — NEW
- `components/dashboard/inlineApps/teamforce/sections/EmployeeForm.tsx` — NEW
- `components/dashboard/inlineApps/teamforce/sections/BranchesSection.tsx` — NEW
- `components/dashboard/inlineApps/teamforce/sections/DepartmentsSection.tsx` — NEW
- `components/dashboard/inlineApps/teamforce/sections/AttendanceSection.tsx` — NEW stub
- `components/dashboard/inlineApps/teamforce/sections/PayrollSection.tsx` — NEW stub
- `components/dashboard/inlineApps/teamforce/sections/SettingsSection.tsx` — NEW stub

---

## Phased execution order

1. **Phase 1** — Backend models + routes + mount in app.ts. Test with curl.
2. **Phase 2a** — Wire Marketplace catalog + AppContainer for inline rendering. Confirm Teamforce opens as a blank shell.
3. **Phase 2b** — Build shell (TeamforceApp.tsx) with sub-sidebar + section switcher. API client + types.
4. **Phase 2c** — DashboardSection + EmployeesSection (list view with real data).
5. **Phase 2d** — EmployeeForm (the large ~40-field form) + admin role management.
6. **Phase 2e** — BranchesSection + DepartmentsSection CRUD.
7. **Phase 2f** — Polish: stubs for Attendance/Payroll/Settings, edge cases, error handling.

---

## Verification

1. Backend: `npm run build` in garagenew-backend, smoke test endpoints with curl
2. Frontend: `npm run build` in garage-web-app-nextjs-v1
3. Founder flow: BackOffice → Teamforce → Employees → Add Employee → Save → verify in DB
4. Admin flow: Founder promotes stakeholder → stakeholder opens Teamforce → can edit profiles, sees salary/bank
5. Regular member flow: Assigned stakeholder opens Teamforce → read-only, no sensitive fields
6. Regression: Deals/Taskrooms/Flowboards still open as iframes from the same Marketplace
