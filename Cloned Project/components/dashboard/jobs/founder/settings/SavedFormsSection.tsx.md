# `components/dashboard/jobs/founder/settings/SavedFormsSection.tsx`

> A18 · Saved forms — application forms saved from the builder for reuse.

**Kind:** React component · **Lines:** 81 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A18 · Saved forms — application forms saved from the builder for reuse.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Card`×2 (components/dashboard/jobs/ui.tsx), `FileText`×2 (lucide-react), `SectionHeading` (components/dashboard/jobs/founder/settings/shared.tsx), `Trash2` (lucide-react)

### Props

- **`SavedFormsSection`**: `props: SectionProps`

**Hooks used:** `useConfirm` (components/dashboard/jobs/ui.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SavedFormsSection)` | component | `SavedFormsSection({ data, onSaved }: SectionProps)` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Card`, `formatDate`, `useConfirm`
  - `components/dashboard/jobs/founder/settings/shared.tsx` — `SectionHeading`, `errorMessage`, `SectionProps`
- **Packages:**
  - `react`
  - `lucide-react` — `FileText`, `Trash2`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/settings/SettingsPage.tsx`
