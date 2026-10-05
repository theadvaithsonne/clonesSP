# `app/(dashboard)/taskroom/migrate/page.tsx`

> Next.js page rendered at `/taskroom/migrate`.

**Kind:** Next.js page · **Lines:** 546 · **Directive:** `"use client"` · **Route:** `/taskroom/migrate` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SummaryRow`×6 (local), `ErrorMsg`×3 (local), `Loader`×3 (local), `Empty`×3 (local), `ItemRow`×3 (local), `Stepper` (local)

**Hooks used:** `useState`×16, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TaskRoomWizard)` | component | `TaskRoomWizard()` | 228 |

## Interfaces

- **External HTTP calls:**
  - `GET uatapi.garage.appworkspaces/me?size=50` (L64)
  - `GET uatapi.garage.appspaces/me?workspaceId=${workspaceId}&page=1&size=50` (L73)
  - `POST https://uatapi.garage.app/taskroomv2/v1/migerate` (L88)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_TASKROOM_URL`
- **Browser storage / cookies:** `garage_tok` (localStorage: get)
- **External hosts mentioned in the code:** `uatapi.garage.app`

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `react-hot-toast`
  - `jwt-decode` — `jwtDecode`

## Used by

Entry: reached by the Next.js router at `/taskroom/migrate` (page).
