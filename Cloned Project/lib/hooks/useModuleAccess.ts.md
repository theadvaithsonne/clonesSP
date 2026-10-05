# `lib/hooks/useModuleAccess.ts`

> The single gate the client checks before unlocking a module's admin console.

**Kind:** React hook · **Lines:** 137 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The single gate the client checks before unlocking a module's admin console.

`GET /rbac/me` already folds the founder bypass in — founders come back with
`isFounder: true` and every module `true` — so callers never have to check
role and permissions separately. Non-founders only read `true` for a module
once they have *accepted* the founder's offer.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×8, `useCallback`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `ModuleAccess` | type |  | 24 |
| `useModuleAccess` | hook | `useModuleAccess(): ModuleAccess` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/rbac-api.ts` — `fetchModules`, `fetchMyPermissions`, `currentOrgId`, `RBAC_CHANGED_EVENT`, `ModuleKey`, `ModulePermissions`, `RbacModule`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`

## Used by

- `components/dashboard/MainSidebar.tsx`
- `components/dashboard/NewTabPicker.tsx`
