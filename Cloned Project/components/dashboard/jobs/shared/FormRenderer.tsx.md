# `components/dashboard/jobs/shared/FormRenderer.tsx`

> Renders one page of a job's application form.

**Kind:** React component · **Lines:** 486 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Renders one page of a job's application form. Used by the founder's
"Preview as candidate" and by the candidate's apply flow, so both always
show the same thing. Conditional fields are evaluated here with the same
rules as the backend (services/jobs.ts: conditionMet / fieldState).

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `FieldInput` (local), `ArrowUp` (lucide-react), `ArrowDown` (lucide-react), `FileField` (local), `FieldLabel` (local), `FileText` (lucide-react), `X` (lucide-react), `Loader2` (lucide-react), `Upload` (lucide-react)

### Props

- **`FormRenderer`**: `page: FormPage`, `allFields: FormField[]`, `answers: AnswerMap`, `onChange: (fieldId: string, patch: Partial<Answer>) => void`, `errors?: Record<string, string>`, `onUpload?: (file: File) => Promise<AnswerFile>`, `prefilledIds?: Set<string>`, `readOnly?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AnswerMap` | type |  | 14 |
| `conditionMet` | function | `conditionMet(cond: FieldCondition, answers: AnswerMap, byId: Map<string, FormField>): boolean` | 21 |
| `fieldState` | function | `fieldState(f: FormField, answers: AnswerMap, byId: Map<string, FormField>)` | 44 |
| `default (FormRenderer)` | component | `FormRenderer({ page, allFields, answers, onChange, errors = {}, onUpload…)` | 78 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/ui.tsx` — `GOLD`, `errorMessage`
  - `components/dashboard/jobs/types.ts` — `Answer`, `AnswerFile`, `FieldCondition`, `FormField`, `FormPage`, `(types only)`
- **Packages:**
  - `react`
  - `lucide-react` — `ArrowDown`, `ArrowUp`, `FileText`, `Loader2`, `Upload`, `X`
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/candidate/ApplyFlow.tsx`
- `components/dashboard/jobs/founder/wizard/StepForm.tsx`
- `components/dashboard/jobs/founder/workspace/FormTab.tsx`
