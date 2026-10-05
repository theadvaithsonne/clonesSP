# `app/careers/hooks/useVacancies.ts`

> React hook `useVacancies`.

**Kind:** React hook · **Lines:** 124 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useCallback`×4, `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useVacancies` | hook | `useVacancies()` | 7 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/careers/vacancies` (L16)
  - `POST /backend/careers/vacancies?orgId=${orgId}` (L39)
  - `PATCH /backend/careers/vacancies/${id}?orgId=${orgId}` (L68)
  - `DELETE /backend/careers/vacancies/${id}?orgId=${orgId}` (L98)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `app/careers/types.ts` — `Vacancy`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useCallback`

## Used by

- `app/careers/CareersClient.tsx`
- `app/careers/components/ApplicationsTab.tsx`
