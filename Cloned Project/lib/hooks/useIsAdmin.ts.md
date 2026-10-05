# `lib/hooks/useIsAdmin.ts`

> React hook `useIsAdmin`.

**Kind:** React hook · **Lines:** 58 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`, `useCallback`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useIsAdmin` | hook | `useIsAdmin(): UseIsAdminResult` | 24 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/team/list` (L31)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`, `getUserIdFromToken`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`, `useCallback`

## Used by

- `components/dashboard/MainSidebar.tsx`
