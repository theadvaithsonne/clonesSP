# `app/careers/CareersClient.tsx`

> React component `CareersClient`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 246 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Skeleton`×5 (components/ui/skeleton.tsx), `VacancyCard`×2 (app/careers/components/VacancyCard.tsx), `TabsTrigger`×2 (components/ui/tabs.tsx), `TabsContent`×2 (components/ui/tabs.tsx), `Search` (lucide-react), `Input` (components/ui/input.tsx), `LayoutList` (lucide-react), `LayoutGrid` (lucide-react), `Card` (components/ui/card.tsx), `Briefcase` (lucide-react), `Button` (components/ui/button.tsx), `Plus` (lucide-react), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx), `ApplicationsTab` (app/careers/components/ApplicationsTab.tsx), `CreateVacancyDialog` (app/careers/components/CreateVacancyDialog.tsx)

**Hooks used:** `useState`×4, `useAmIFounder` (lib/hooks/useAmIFounder.ts), `useVacancies` (app/careers/hooks/useVacancies.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CareersClient)` | component | `CareersClient()` | 24 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/hooks/useAmIFounder.ts` — `useAmIFounder`
  - `app/careers/hooks/useVacancies.ts` — `useVacancies`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/card.tsx` — `Card`
  - `components/ui/tabs.tsx` — `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger`
  - `components/ui/skeleton.tsx` — `Skeleton`
  - `app/careers/components/VacancyCard.tsx` — `VacancyCard (default)`
  - `app/careers/components/CreateVacancyDialog.tsx` — `CreateVacancyDialog (default)`
  - `app/careers/components/ApplicationsTab.tsx` — `ApplicationsTab (default)`
  - `app/careers/types.ts` — `Vacancy`, `(types only)`
- **Packages:**
  - `react` — `useState`, `useMemo`
  - `lucide-react` — `Briefcase`, `Plus`, `Search`, `LayoutList`, `LayoutGrid`
  - `sonner` — `toast`

## Used by

- `app/careers/page.tsx`
