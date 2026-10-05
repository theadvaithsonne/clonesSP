# `components/dashboard/FounderLeaveDashboard.tsx`

> React component `FounderLeaveDashboard`.

**Kind:** React component · **Lines:** 257 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Calendar`×4 (lucide-react), `Button`×3 (components/ui/button.tsx), `CheckCircle`×2 (lucide-react), `XCircle`×2 (lucide-react), `AlertCircle` (lucide-react), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `User` (lucide-react), `CardTitle` (components/ui/card.tsx), `Badge` (components/ui/badge.tsx), `CardContent` (components/ui/card.tsx), `Clock` (lucide-react)

**Hooks used:** `useState`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FounderLeaveDashboard)` | component | `FounderLeaveDashboard()` | 27 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/betty/pending-leave-requests?orgId=${orgId}` (L35)
  - `PATCH /backend/betty/leave-requests/${requestId}?orgId=${orgId}` (L49)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api.ts` — `api`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `framer-motion` — `motion`, `AnimatePresence`
  - `lucide-react` — `Calendar`, `Clock`, `User`, `CheckCircle`, `XCircle`, `AlertCircle`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/layout.tsx`
- `components/dashboard/ManagementPage.tsx`
