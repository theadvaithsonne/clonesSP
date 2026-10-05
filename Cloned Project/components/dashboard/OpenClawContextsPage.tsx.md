# `components/dashboard/OpenClawContextsPage.tsx`

> React component `OpenClawContextsPage`.

**Kind:** React component · **Lines:** 81 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Database` (lucide-react), `Zap` (lucide-react), `ManualContextsView` (components/dashboard/ManualContextsView.tsx), `ThirdPartyContextsView` (components/dashboard/ThirdPartyContextsView.tsx), `OpenClawContextsPageInternal` (local)

**Hooks used:** `useState`×2, `useMemo`, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OpenClawContextsPage)` | component | `OpenClawContextsPage()` | 76 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`, `getToken`
  - `components/dashboard/ManualContextsView.tsx` — `ManualContextsView`
  - `components/dashboard/ThirdPartyContextsView.tsx` — `ThirdPartyContextsView`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`, `useCallback`
  - `sonner` — `toast`
  - `lucide-react` — `Database`, `Zap`

## Used by

- `components/dashboard/AIManagementPage.tsx`
