# `components/dashboard/OpenClawJobsPage.tsx`

> React component `OpenClawJobsPage`.

**Kind:** React component · **Lines:** 863 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Badge`×6 (components/ui/badge.tsx), `Button`×6 (components/ui/button.tsx), `Bot`×3 (lucide-react), `Activity`×2 (lucide-react), `Loader2`×2 (lucide-react), `Calendar`×2 (lucide-react), `ChevronRight`×2 (lucide-react), `Play`×2 (lucide-react), `AlertCircle`×2 (lucide-react), `Hash` (lucide-react), `CheckCircle2` (lucide-react), `Clock` (lucide-react), `ArrowLeft` (lucide-react), `Pause` (lucide-react), `Trash2` (lucide-react), `RotateCcw` (lucide-react), `ChevronDown` (lucide-react), `OpenClawJobsPageInternal` (local)

**Hooks used:** `useState`×7, `useEffect`×4, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (OpenClawJobsPage)` | component | `OpenClawJobsPage()` | 858 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/auth.ts` — `getOrgId`, `getToken`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/badge.tsx` — `Badge`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `Play`, `Pause`, `CheckCircle2`, `Clock`, `RotateCcw`, `ChevronRight`, …

## Used by

- `components/dashboard/AIManagementPage.tsx`
