# `app/careers/hooks/useApplications.ts`

> React hook `useApplications`.

**Kind:** React hook · **Lines:** 88 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×3, `useCallback`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `useApplications` | hook | `useApplications()` | 12 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/careers/applications?${params.toString()}` (L32)
  - `PATCH /backend/careers/applications/${id}?orgId=${orgId}` (L57)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `app/careers/types.ts` — `Application`
- **Packages:**
  - `react` — `useState`, `useCallback`

## Used by

- `app/careers/components/ApplicationsTab.tsx`
