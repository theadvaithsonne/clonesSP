# `components/dashboard/jobs/founder/wizard/StepDescription.tsx`

> A4 · Step 2 — Description: the five sections, skills, education, perks and the office's own "about".

**Kind:** React component · **Lines:** 409 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A4 · Step 2 — Description: the five sections, skills, education, perks and
the office's own "about". "Write with AI" drafts the sections from a few
inputs; "Use a previous job" copies them from another of the office's roles.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/dashboard/jobs/ui.tsx), `Sparkles`×3 (lucide-react), `Label`×3 (components/dashboard/jobs/ui.tsx), `Chip`×3 (components/dashboard/jobs/ui.tsx), `Card`×3 (components/dashboard/jobs/ui.tsx), `StepHeading` (components/dashboard/jobs/founder/wizard/StepBasics.tsx), `Copy` (lucide-react), `RichTextEditor` (components/ui/rich-text-editor.tsx), `Plus` (lucide-react), `SwitchControl` (components/dashboard/jobs/ui.tsx), `TextInput` (components/dashboard/jobs/ui.tsx), `Checkbox` (components/dashboard/jobs/ui.tsx), `AiDrawer` (local), `CopyFromJobModal` (local), `Drawer` (components/dashboard/jobs/ui.tsx), `CustomSelect` (components/dashboard/jobs/ui.tsx), `TextArea` (components/dashboard/jobs/ui.tsx), `SafeHtml` (components/dashboard/jobs/ui.tsx), `Modal` (components/dashboard/jobs/ui.tsx)

### Props

- **`StepDescription`**: `props: StepProps`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StepDescription)` | component | `StepDescription({ job, detail, update }: StepProps)` | 43 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/rich-text-editor.tsx` — `RichTextEditor`
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Card`, `Checkbox`, `Chip`, `CustomSelect`, `Drawer`, `GOLD`, `Label`, … +7
  - `components/dashboard/jobs/types.ts` — `Job`, `PostingRow`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/JobWizard.tsx` — `StepProps`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/StepBasics.tsx` — `StepHeading`
- **Packages:**
  - `react`
  - `lucide-react` — `Copy`, `Plus`, `Sparkles`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
