# `app/(dashboard)/workspace/hooks/useFloors.ts`

> React hook `useFloors`.

**Kind:** React hook · **Lines:** 157

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×8, `useCallback`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useFloors` | hook | `useFloors(me: string, amIFounder: boolean)` | 6 |

## Interfaces

- **Browser storage / cookies:** `garage_org_id` (localStorage: get)
- **Timers / queues:** `setTimeout` at L47

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `app/(dashboard)/workspace/types.ts` — `Floor`, `FloorMember`
- **Packages:**
  - `react` — `useState`, `useCallback`, `useEffect`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
