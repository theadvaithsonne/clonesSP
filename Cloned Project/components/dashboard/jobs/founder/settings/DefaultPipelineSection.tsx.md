# `components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx`

> A18 · Default pipeline — the stages every new job starts with.

**Kind:** React component · **Lines:** 213 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A18 · Default pipeline — the stages every new job starts with. Applied
stays first and Hired last; the stages between can be renamed, re-typed,
given an owner, reordered, added and removed. Existing jobs keep their own.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SectionHeading` (components/dashboard/jobs/founder/settings/shared.tsx), `Button` (components/dashboard/jobs/ui.tsx), `RotateCcw` (lucide-react), `Card` (components/dashboard/jobs/ui.tsx), `Lock` (lucide-react), `ArrowUp` (lucide-react), `ArrowDown` (lucide-react), `Trash2` (lucide-react), `Plus` (lucide-react), `SaveBar` (components/dashboard/jobs/founder/settings/shared.tsx)

### Props

- **`DefaultPipelineSection`**: `props: SectionProps`

**Hooks used:** `useDraft` (components/dashboard/jobs/founder/settings/shared.tsx), `useLoad` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DefaultPipelineSection)` | component | `DefaultPipelineSection({ data, onSaved, onDirtyChange }: SectionProps)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CATEGORY_META`, `newId`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `GOLD`, `useLoad`
  - `components/dashboard/jobs/types.ts` — `StageCategory`, `(types only)`
  - `components/dashboard/jobs/founder/settings/shared.tsx` — `SaveBar`, `SectionHeading`, `errorMessage`, `useDraft`, `SectionProps`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowDown`, `ArrowUp`, `Lock`, `Plus`, `RotateCcw`, `Trash2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
