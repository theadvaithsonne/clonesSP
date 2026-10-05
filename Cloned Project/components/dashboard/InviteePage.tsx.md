# `components/dashboard/InviteePage.tsx`

> React component `InvitesPage`.

**Kind:** React component · **Lines:** 352 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `Loader2`×3 (lucide-react), `Users` (lucide-react), `RotateCw` (lucide-react), `Mail` (lucide-react), `Badge` (components/ui/badge.tsx), `Shield` (lucide-react), `Send` (lucide-react), `Ban` (lucide-react), `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react)

**Hooks used:** `useState`×6, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (InvitesPage)` | component | `InvitesPage()` | 34 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/invites/list?orgId=${orgId}` (L58)
  - `GET /backend/floors/roster?orgId=${orgId}` (L63)
  - `PATCH /backend/invites/${id}/resend?orgId=${orgId}` (L105)
  - `PATCH /backend/invites/${id}/revoke?orgId=${orgId}` (L125)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
- **Packages:**
  - `react` — `useEffect`, `useState`, `useMemo`
  - `lucide-react` — `RotateCw`, `Mail`, `Shield`, `Ban`, `Send`, `Loader2`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/ManagementPage.tsx`
