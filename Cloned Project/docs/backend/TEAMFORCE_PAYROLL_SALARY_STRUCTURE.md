# Teamforce Payroll — Salary Structure Setup

End-to-end documentation for the Salary Structure feature under Teamforce → Payroll. Covers model, routes, permissions, frontend UI, and known-good data flow.

---

## 1. High-level scope

Payroll is gated behind **founder + admin** only. Inside Payroll, admins can define one or more **Salary Structures** (named templates) that hold:

- **Fixed Earnings** — array of components (e.g. Basic, HRA, Transport Allowance). Each has `calculationType` (`flat` / `% of Basic` / `% of CTC`), `value`, and `taxable` flag.
- **Deductions** — array of components (e.g. PF, Professional Tax). Each has `calculationType`, `value`, and `autoCalc` flag.
- **Tax Settings** — `taxRegime` (`old` | `new`) + `autoTds` toggle.

Multiple structures coexist per org. Names are unique within active (non-deleted) structures of that org.

Role detection on the client:
- `useAmIFounder()` → founder (full access)
- `getEmployee(userId).teamforceRole === "admin"` → admin (full access)
- anyone else → Access Restricted screen

Sidebar tab gating: [components/dashboard/backOfficeAppSideBar.tsx:237](../frontend/garage-web-app-nextjs-v1/components/dashboard/backOfficeAppSideBar.tsx#L237) — `disabled: !tfHasWriteAccess`.

---

## 2. Backend changes

### 2.1 New MongoDB model

#### `src/models/teamforce/teamforceSalaryStructure.model.ts` (new)

**Why:** one collection, many named structures per org. Sub-arrays are embedded (not separate collections) because they never exist outside of a structure and are always read/written together.

**Schema:**

```ts
EarningSchema { componentName, calculationType, value, taxable }       // _id: false
DeductionSchema { componentName, calculationType, value, autoCalc }     // _id: false

TeamforceSalaryStructureSchema {
  orgId: ObjectId (indexed, ref Organization),
  name: string (required, trimmed),
  earnings: [EarningSchema],
  deductions: [DeductionSchema],
  taxRegime: "old" | "new" (default "new"),
  autoTds: boolean (default true),
  isActive: boolean (default true),   // soft-delete flag
  timestamps: true
}
```

**Exports:** `CALC_TYPES = ["flat", "percentBasic", "percentCTC"]`, `TAX_REGIMES = ["old", "new"]`, `TeamforceSalaryStructure` (model).

**Unique index with partial filter:**

```ts
TeamforceSalaryStructureSchema.index(
  { orgId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
);
```

**Why the partial filter:** soft-deleted rows (`isActive: false`) are preserved in the collection, but their names shouldn't block a user from creating a new active structure with the same name. The partial filter excludes soft-deleted rows from the uniqueness check.

---

### 2.2 New route: `src/routes/teamforce/salaryStructures.ts`

Mounted in [`src/routes/teamforce/index.ts`](src/routes/teamforce/index.ts#L22) at `/teamforce/salary-structures`.

| Method | Path | Who | Purpose |
|---|---|---|---|
| `GET` | `/` | founder / admin | List all active structures for the org, sorted `createdAt: 1` (stable ordering). |
| `POST` | `/` | founder / admin | Create a new structure. Returns **409** if name already in use by an active structure. |
| `PATCH` | `/:id` | founder / admin | Partial update. Zod `updateSchema = bodySchema.partial()`. Only matches active rows. Returns **409** on name collision. |
| `DELETE` | `/:id` | founder / admin | Soft-delete: sets `isActive: false`. |

Every handler calls:
1. `requireAuth` middleware
2. `getOrgIdStrict(req, res)` — reads `?orgId=` query (client preference) with JWT-embedded `orgId` fallback. 400 if neither is present.
3. `requireTeamforceWriteAccess(req, res)` for mutating methods — returns 403 unless the caller is founder OR has `teamforceRole: "admin"` profile in the target org.

**Zod schemas:**

```ts
earningSchema = { componentName: trim().min(1), calculationType: enum, value: number, taxable: bool }
deductionSchema = { componentName: trim().min(1), calculationType: enum, value: number, autoCalc: bool }
bodySchema = { name: trim().min(1).max(200), earnings: [], deductions: [], taxRegime, autoTds }
updateSchema = bodySchema.partial()
```

Rows with blank `componentName` are filtered out on the client before POST / PATCH so Zod never rejects them.

**409 handling:** `err.code === 11000` from MongoDB → surfaced as a human-readable `{ error }` message that the frontend displays in a toast.

---

### 2.3 Router mount

```ts
// src/routes/teamforce/index.ts
import salaryStructuresRouter from "./salaryStructures";
router.use("/salary-structures", salaryStructuresRouter);
```

---

## 3. Frontend changes

### 3.1 Types — [`teamforce/types.ts`](../frontend/garage-web-app-nextjs-v1/components/dashboard/inlineApps/teamforce/types.ts#L185-L211)

```ts
export type CalcType = "flat" | "percentBasic" | "percentCTC";
export type TaxRegime = "old" | "new";

export interface EarningComponent {
  componentName: string;
  calculationType: CalcType;
  value: number;
  taxable: boolean;
}

export interface DeductionComponent {
  componentName: string;
  calculationType: CalcType;
  value: number;
  autoCalc: boolean;
}

export interface SalaryStructure {
  _id: string;
  orgId: string;
  name: string;
  earnings: EarningComponent[];
  deductions: DeductionComponent[];
  taxRegime: TaxRegime;
  autoTds: boolean;
  isActive: boolean;
}
```

### 3.2 API wrappers — [`teamforce/api.ts`](../frontend/garage-web-app-nextjs-v1/components/dashboard/inlineApps/teamforce/api.ts#L332-L363)

All four route the request through `withOrg(path)` which appends the active org from `localStorage` as `?orgId=…`:

| Function | HTTP |
|---|---|
| `listSalaryStructures()` | `GET /teamforce/salary-structures` |
| `createSalaryStructure(data)` | `POST /teamforce/salary-structures` |
| `updateSalaryStructure(id, data)` | `PATCH /teamforce/salary-structures/:id` |
| `deleteSalaryStructure(id)` | `DELETE /teamforce/salary-structures/:id` |

Payload type for create/update: `Partial<Omit<SalaryStructure, "_id" | "orgId" | "isActive">>`.

### 3.3 UI — [`PayrollSection.tsx`](../frontend/garage-web-app-nextjs-v1/components/dashboard/inlineApps/teamforce/sections/PayrollSection.tsx)

**Access gate:** founder check runs first; admin check falls back to `getEmployee(uid).teamforceRole === "admin"`. While unresolved → spinner. Unauthorized → "Access Restricted" card.

**Header bar** (top of the section):

- Breadcrumb: `Home / Payroll` or `Home / Payroll / Salary Structure Setup`
- Title: `Payroll Overview` / `Salary Structure Setup`
- Right side: `Salary Structure` button (→ opens setup view) + month navigator `‹ Mar 2026 ›` on the overview; `Back to Payroll` on the setup view.

**Two views** switched by `useState<View>("overview" | "salary-structure")`:

1. **`PayrollOverview`** — placeholder with coming-soon copy. Will host future processing / salary-slip / analytics widgets.

2. **`SalaryStructureView`** — two-pane layout:

   **Left pane (`<aside className="w-72">`):**
   - Yellow `+ New Structure` button (top).
   - Scrollable list of existing structures. Each item renders as `{name}` + subtitle `"{N} earnings · {M} deductions"`. Active (selected) state uses yellow tint + pencil icon.
   - Empty state: `"No structures yet. Click 'New Structure' to create one."`

   **Right pane (`<section className="flex-1">`):**
   - Empty state before any selection/click: icon + copy + inline `New Structure` button.
   - When `showForm` is true:
     - **Structure Name** — single text input.
     - **Fixed Earnings** — `<ComponentTable>` with columns: Component Name, Calculation Type, Value, Taxable (checkbox), delete.
     - **Deductions** — `<ComponentTable>` with columns: Component Name, Calculation Type, Value, Auto Calc (checkbox), delete.
     - **Tax Settings** — Old/New Regime radio cards with bullet-point copy describing each regime, then Auto-TDS checkbox with explanatory subtitle.
     - **Sticky footer** — red Delete (only when editing) · Cancel · yellow `Save Structure`.

### 3.4 Reusable helpers defined inside `PayrollSection.tsx`

- **`ComponentTable`** — generic over `EarningComponent | DeductionComponent`. Parameterised via `lastColKey: "taxable" | "autoCalc"` + `lastColLabel`. Avoids ~90 lines of duplicate JSX.
- **`NumericInput`** — wraps `<input type="text" inputMode="decimal">` with local string state. Keeps `""` when the numeric value is 0 so the default `0` doesn't stick, and preserves what the user typed (no `"040"` round-trip artifact from `Number()` normalization). Exposes a numeric `onChange(v: number)`.
- **`StructureFormState`** — flat client-only form type. Separate from the persisted `SalaryStructure` so the form doesn't carry `_id` / `orgId` / `isActive`. `onSelect` → form; `onSave` → payload.
- **`apiErrorMessage(err, fallback)`** — parses JSON `{ error }` bodies from the `api<T>` helper (which throws `new Error(await res.text())`) and falls back gracefully. Used so the 409 from a duplicate name shows the backend-supplied message in the toast.

---

## 4. Data flow

| Step | Where | What happens |
|---|---|---|
| 1. Open Payroll tab | sidebar | Gated by `!tfHasWriteAccess` — disabled for non-admins/non-founders. |
| 2. Component mounts | `PayrollSection` | Runs founder/admin check. Renders overview. |
| 3. Click **Salary Structure** | header button | `setView("salary-structure")`. |
| 4. `SalaryStructureView` mounts | effect | Calls `listSalaryStructures()` → populates left-pane list. |
| 5. Click **+ New Structure** | left pane | `onNew()` → clears form, shows right pane with empty form (`Basic` earning pre-filled). |
| 6. Fill fields + Save | footer | Validates `name.trim()`. Filters empty-name component rows. Calls `createSalaryStructure(payload)`. Shows success toast, resets form, reloads list. |
| 7. Click an existing structure | left pane | `onSelect(s)` → populates form with its values. `editingId` = `s._id`. |
| 8. Edit + Save | footer | Calls `updateSalaryStructure(editingId, payload)`. |
| 9. Delete | footer (editing only) | Confirm → `deleteSalaryStructure(id)` (soft-delete). Reloads list. |

---

## 5. Error handling

- **Load failure** → toast `"Failed to load salary structures"`.
- **Duplicate name** → backend sends 409 with `error: "A structure named \"…\" already exists."` (create) or `"A structure with that name already exists."` (update). Frontend surfaces this via `apiErrorMessage()` → toast.
- **Missing name** → client-side guard: toast `"Structure name is required"` before hitting the API.
- **Auth / permission failure** → backend returns 401/403. Frontend treats as a generic save failure.

React Strict Mode note: the effect runs twice in dev, so if the backend is actually down you'll see two identical toasts. This is normal dev-mode behavior and does not affect production.

---

## 6. Migration notes

- No migration needed — fresh collection. First user to hit `listSalaryStructures()` gets `[]`.
- Soft-delete is forward-compatible: if payroll-processing later needs to reference historical structures (e.g. for a pay run that happened while a since-deleted structure was active), the records are still in the DB. Only the GET filters on `isActive: true`.
- If you ever need to reuse a deleted name, the partial-filter index allows it without requiring a hard delete or restore flow.

---

## 7. Not in scope (yet)

- **Assignment to employees** — there's currently no `employeeProfile.salaryStructureId` link. Salary structures are defined but not yet applied to individual employees.
- **Payroll runs** — no pay-run collection, no slip generation, no tax calculation engine.
- **Versioning** — structures are mutable in place; no history of previous versions is retained.
- **Import / export** — no CSV upload or template library.

These are intentional for the initial feature cut. Structure definition is the foundation; processing will build on top once the shape stabilises.
