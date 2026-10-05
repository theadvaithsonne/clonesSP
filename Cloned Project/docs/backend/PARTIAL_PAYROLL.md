# Partial Payroll Runs

## Overview

Payroll supports running payroll for a **subset** of employees in a month — by Department, Branch, or specific People — while keeping the original **1 run per month per org** constraint.

There is always exactly one payroll run per `(orgId, fyYear, fyMonth)`. A PARTIAL run adds employees incrementally to that single run; a FULL run processes all eligible employees at once.

---

## Run Types

| Type | Behaviour |
|------|-----------|
| `FULL` | Processes all eligible employees (default, existing behaviour) |
| `PARTIAL` | Adds only scope-resolved employees to the existing DRAFT run |

---

## How Partial Runs Work

1. Admin clicks **"New Partial Run"** on the Payroll Overview page.
2. Selects FY month/year.
3. Picks scope — any combination of:
   - **Departments** (all employees in selected departments)
   - **Branches** (all employees in selected branches)
   - **Specific People** (individual employee selection)
4. Clicks **"Run Partial Payroll"**.
5. Backend finds or creates the single DRAFT run for that month, then resolves the scope, skips employees already processed in this run, and creates transactions for the remainder.

The scope label (e.g. `"Dept: Engineering · Branch: Mumbai"`) is stored and shown in the overview table.

---

## 1-Run-Per-Month Constraint

- The unique MongoDB index on `(orgId, fyYear, fyMonth)` is **retained** — only one run can exist per month per org.
- **Upsert-DRAFT pattern**: `POST /teamforce/payroll-runs` finds an existing DRAFT run and adds to it, or creates a new one. If the existing run is `APPROVED` or `PAID`, the request is rejected with `409`.
- PARTIAL runs are **incremental**: calling PARTIAL multiple times for the same month keeps adding employees to the same DRAFT (already-processed employees are skipped via `includedUserIds`).
- FULL runs process all eligible employees and upsert their transactions (idempotent).

---

## Remaining Employees

- `GET /teamforce/payroll-runs/month-summary?fyYear=&fyMonth=` returns employees not yet processed in the current month's run.
- The **"Specific People"** scope selector in the frontend uses this to show only remaining employees.

---

## API Changes

### `POST /teamforce/payroll-runs`

New optional body fields:

```json
{
  "fyMonth": 1,
  "fyYear": 2025,
  "runType": "PARTIAL",
  "scope": {
    "departmentIds": ["<id>"],
    "branchIds": ["<id>"],
    "userIds": ["<id>"],
    "label": "Engineering Dept"
  }
}
```

- `runType` defaults to `"FULL"` (backward compatible).
- `scope` is required when `runType` is `"PARTIAL"`.
- Returns `409` if the existing run is `APPROVED` or `PAID`.

### `GET /teamforce/payroll-runs/month-summary`

Query params: `fyYear`, `fyMonth`

Response:
```json
{
  "runs": [{ "...payroll run doc..." }],
  "processedUserIds": ["..."],
  "remainingEmployees": [
    { "userId": "...", "name": "...", "email": "...", "departmentId": "...", "branchId": "..." }
  ],
  "totalEligible": 20,
  "totalProcessed": 8,
  "totalRemaining": 12
}
```

---

## Model Changes (`TeamforcePayrollRun`)

New fields added (all optional with defaults — backward compatible):

| Field | Type | Description |
|-------|------|-------------|
| `runType` | `"FULL" \| "PARTIAL"` | Defaults to `"FULL"` |
| `scope.departmentIds` | `ObjectId[]` | Departments in scope |
| `scope.branchIds` | `ObjectId[]` | Branches in scope |
| `scope.userIds` | `ObjectId[]` | Explicit users in scope |
| `scope.label` | `string` | Auto-generated human-readable label |
| `includedUserIds` | `ObjectId[]` | Accumulated list of users processed in this run |

---

## Database Index

The unique index on `(orgId, fyYear, fyMonth)` is **kept**:

```js
// This index must exist — do NOT drop it.
// It enforces 1 run per month per org at the DB level.
db.teamforcepayrollruns.getIndexes()
// Should show: { orgId: 1, fyYear: 1, fyMonth: 1 }, unique: true
```

If it was accidentally dropped, restore it:
```js
db.teamforcepayrollruns.createIndex(
  { orgId: 1, fyYear: 1, fyMonth: 1 },
  { unique: true }
)
```

---

## Exclusion Logic for Partial Runs

Employees are **skipped** in a PARTIAL run if they already have a transaction in the current run (`includedUserIds` check). This allows calling PARTIAL multiple times to incrementally add more employees without duplicating work.

---

## Full Payroll Behaviour (Unchanged)

FULL runs always process all eligible employees and upsert their transactions. This is idempotent — running FULL again for the same month updates existing transactions and adds any new employees.

---

## Frontend Changes

- Two buttons on the Payroll Overview header: **"New Partial Run"** (outline) and **"New Payroll Run"** (primary).
- Overview table shows an amber **"Partial"** badge on runs where `runType === "PARTIAL"` — safely skipped for older runs where `runType` is undefined.
- `scope?.label` rendered with optional chaining — safe for pre-existing FULL runs with no scope.
