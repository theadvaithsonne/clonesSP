# `lib/hooks/useMyOffices.ts`

> React hook `useMyOffices`.

**Kind:** React hook · **Lines:** 97

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×3, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MyOffice` | interface |  | 5 |
| `useMyOffices` | hook | `useMyOffices(enabled = true)` — The offices (organizations) the signed-in user has joined. | 33 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/auth/me` (L48)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`

## Used by

- `components/reviews/RateOfficesForm.tsx`
