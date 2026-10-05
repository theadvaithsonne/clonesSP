# `components/dashboard/OpenClawTasksPage.tsx`

> React component `OpenClawTasksPage`.

**Kind:** React component · **Lines:** 413 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ClipboardList`×2 (lucide-react), `Icon`×2 (local), `FileText`×2 (lucide-react), `Plug`×2 (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx), `RefreshCw` (lucide-react), `Loader2` (lucide-react), `Badge` (components/ui/badge.tsx), `AlertCircle` (lucide-react), `X` (lucide-react), `CheckCircle2` (lucide-react), `Circle` (lucide-react), `Bug` (lucide-react), `AlertTriangle` (lucide-react), `OpenClawTasksPageInternal` (local)

**Hooks used:** `useState`×4, `useCallback`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OpenClawTasksPage)` | component | `OpenClawTasksPage()` | 408 |

## Interfaces

- **Next.js API routes called (same origin):**
  - `` GET /api/openclaw/tasks${qs ? `?${qs}` : ""} `` (L100)

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`, `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/input.tsx` — `Input`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `CheckCircle2`, `AlertCircle`, `AlertTriangle`, `Clock`, `Circle`, `Loader2`, …

## Used by

- `components/dashboard/AIManagementPage.tsx`
