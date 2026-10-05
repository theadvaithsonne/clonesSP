# `app/(dashboard)/workspace/hooks/useLocalMedia.ts`

> React hook `useLocalMedia`.

**Kind:** React hook · **Lines:** 86

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×3, `useEffect`×2, `useRef`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useLocalMedia` | hook | `useLocalMedia(me: string)` — Lazy local-media container for the workspace. | 25 |

## Interfaces

- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`, `useRef`

## Used by

- `app/(dashboard)/workspace/WorkspaceClient.tsx`
