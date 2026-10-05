# `store/flowboard/employeeStore.tsx`

> React hooks `useEmployees`, `useDepartments`, `useSelectedEmployees`, `useEmployeeLoading`.

**Kind:** client state store · **Lines:** 587

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useEmployeeStore`×5 (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Employee` | interface |  | 8 |
| `EmployeeFormData` | interface |  | 32 |
| `EmployeeApiResponse` | interface |  | 54 |
| `Department` | interface |  | 77 |
| `DepartmentApiResponse` | interface |  | 88 |
| `EmployeeFilters` | interface |  | 99 |
| `EmployeeState` | interface |  | 108 |
| `useEmployeeStore` | const | `= create<EmployeeState>()( persist( (set, get) => ({ // Initial state employees: [], departments: […` | 161 |
| `useEmployees` | hook | `useEmployees()` | 582 |
| `useDepartments` | hook | `useDepartments()` | 583 |
| `useSelectedEmployees` | hook | `useSelectedEmployees()` | 584 |
| `useEmployeeLoading` | hook | `useEmployeeLoading()` | 585 |
| `useEmployeeError` | hook | `useEmployeeError()` | 586 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
- **Packages:**
  - `zustand` — `create`, `persist`, `createJSONStorage`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
