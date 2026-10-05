# `components/dashboard/jobs/founder/workspace/FormTab.tsx`

> Job workspace · Application form — the live form exactly as candidates see it (read-only), with its rules called out.

**Kind:** React component · **Lines:** 74 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Job workspace · Application form — the live form exactly as candidates see
it (read-only), with its rules called out. Editing happens in the wizard.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×4 (components/dashboard/jobs/ui.tsx), `FormRenderer` (components/dashboard/jobs/shared/FormRenderer.tsx), `Button` (components/dashboard/jobs/ui.tsx), `Pencil` (lucide-react)

### Props

- **`FormTab`**: `job: Job`, `onEdit: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FormTab)` | component | `FormTab({ job, onEdit }: { job: Job; onEdit: () => void })` | 13 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/constants.ts` — `FIELD_LABELS`, `LAYOUT_TYPES`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`
  - `components/dashboard/jobs/shared/FormRenderer.tsx` — `FormRenderer (default)`
  - `components/dashboard/jobs/types.ts` — `Job`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `Pencil`

## Used by

- `components/dashboard/jobs/founder/workspace/JobWorkspace.tsx`
