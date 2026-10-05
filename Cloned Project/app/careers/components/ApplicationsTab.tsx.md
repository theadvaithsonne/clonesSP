# `app/careers/components/ApplicationsTab.tsx`

> React component `ApplicationsTab`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 212 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SelectItem`×13 (components/ui/select.tsx), `Select`×3 (components/ui/select.tsx), `SelectTrigger`×3 (components/ui/select.tsx), `SelectValue`×3 (components/ui/select.tsx), `SelectContent`×3 (components/ui/select.tsx), `Loader2` (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `ApplicationStatusBadge` (app/careers/components/ApplicationStatusBadge.tsx), `Button` (components/ui/button.tsx), `ExternalLink` (lucide-react)

**Hooks used:** `useState`×3, `useApplications` (app/careers/hooks/useApplications.ts), `useVacancies` (app/careers/hooks/useVacancies.ts), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ApplicationsTab)` | component | `ApplicationsTab()` | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/button.tsx` — `Button`
  - `app/careers/hooks/useApplications.ts` — `useApplications`
  - `app/careers/hooks/useVacancies.ts` — `useVacancies`
  - `app/careers/components/ApplicationStatusBadge.tsx` — `ApplicationStatusBadge (default)`
  - `app/careers/types.ts` — `Application`, `(types only)`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Loader2`, `ExternalLink`, `Search`
  - `sonner` — `toast`
  - `date-fns` — `format`

## Used by

- `app/careers/CareersClient.tsx`
