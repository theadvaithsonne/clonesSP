# `components/dashboard/jobs/founder/settings/shared.tsx`

> Pieces every Jobs settings section shares: the props contract with SettingsPage, a section heading, the dirty-state hook and the save bar.

**Kind:** React component · **Lines:** 104 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Pieces every Jobs settings section shares: the props contract with
SettingsPage, a section heading, the dirty-state hook and the save bar.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/dashboard/jobs/ui.tsx)

### Props

- **`SectionHeading`**: `title: string`, `description?: string`, `action?: React.ReactNode`
- **`SaveBar`**: `dirty: boolean`, `saving: boolean`, `onSave: () => void`, `onDiscard: () => void`, `problem?: string | null`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `SectionProps` | interface |  | 10 |
| `errorMessage` | function | `errorMessage(err: unknown, fallback: string): string` | 18 |
| `SectionHeading` | component | `SectionHeading({ title, description, action, }: { title: string; descripti…)` | 22 |
| `useDraft` | hook | `useDraft(baseline: T, onDirtyChange: (dirty: boolean) => void, compare?: (v: T) => unknown)` — A section's local draft, reset whenever the saved value changes (first load, or after a save), plus whether it differs from what is saved. | 46 |
| `SaveBar` | component | `SaveBar({ dirty, saving, onSave, onDiscard, problem, }: { dirty: bo…)` | 68 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `Button`
  - `components/dashboard/jobs/types.ts` — `JobsSettings`, `SettingsResponse`, `(types only)`
- **Packages:**
  - `react`

## Used by

- `components/dashboard/jobs/founder/settings/CareersPageSection.tsx`
- `components/dashboard/jobs/founder/settings/DefaultPipelineSection.tsx`
- `components/dashboard/jobs/founder/settings/EmailTemplatesSection.tsx`
- `components/dashboard/jobs/founder/settings/PrivacySection.tsx`
- `components/dashboard/jobs/founder/settings/RejectionReasonsSection.tsx`
- `components/dashboard/jobs/founder/settings/SavedFormsSection.tsx`
