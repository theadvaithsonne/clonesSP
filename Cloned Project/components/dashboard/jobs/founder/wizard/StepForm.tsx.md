# `components/dashboard/jobs/founder/wizard/StepForm.tsx`

> A5/A6 · Step 3 — Application form builder.

**Kind:** React component · **Lines:** 1122 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A5/A6 · Step 3 — Application form builder.

  left    field library (click to add to the selected page)
  centre  the pages and their fields; drag to reorder within a page
  right   inspector: Field (label, help, required, options, files),
          Logic (knockout rule, conditional display), Scoring (quiz)

The whole form is sent as one `form.pages` array on every save.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TextInput`×13 (components/dashboard/jobs/ui.tsx), `CustomSelect`×9 (components/dashboard/jobs/ui.tsx), `Button`×8 (components/dashboard/jobs/ui.tsx), `Chip`×6 (components/dashboard/jobs/ui.tsx), `Checkbox`×6 (components/dashboard/jobs/ui.tsx), `SwitchControl`×4 (components/dashboard/jobs/ui.tsx), `Label`×4 (components/dashboard/jobs/ui.tsx), `Plus`×3 (lucide-react), `Trash2`×3 (lucide-react), `Modal`×3 (components/dashboard/jobs/ui.tsx), `StepHeading` (components/dashboard/jobs/founder/wizard/StepBasics.tsx), `LayoutTemplate` (lucide-react), `Eye` (lucide-react), `DndContext` (@dnd-kit/core), `SortableContext` (@dnd-kit/sortable), `SortableField` (local), `UnderlineTabs` (components/dashboard/jobs/ui.tsx), `PageInspector` (local), `FieldInspector` (local), `LogicInspector` (local), `ScoringInspector` (local), `Save` (lucide-react), `CandidatePreview` (local), `TemplatesModal` (local), `SaveFormModal` (local), `GripVertical` (lucide-react), `Lock` (lucide-react), `Copy` (lucide-react), `TextArea` (components/dashboard/jobs/ui.tsx), `OptionsEditor` (local), `X` (lucide-react), `Monitor` (lucide-react), `Smartphone` (lucide-react), `FormRenderer` (components/dashboard/jobs/shared/FormRenderer.tsx)

### Props

- **`StepForm`**: `props: StepProps`

**Hooks used:** `useConfirm` (components/dashboard/jobs/ui.tsx), `useLoad` (components/dashboard/jobs/ui.tsx), `useSensors` (@dnd-kit/core), `useSensor` (@dnd-kit/core), `useSortable` (@dnd-kit/sortable)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StepForm)` | component | `StepForm({ job, detail, update }: StepProps)` | 83 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/jobs/api.ts` — `* as jobsApi`
  - `components/dashboard/jobs/constants.ts` — `CHOICE_TYPES`, `FIELD_GROUPS`, `FIELD_LABELS`, `FILE_TYPES`, `FORM_TEMPLATES`, `LAYOUT_TYPES`, `makeField`, `newId`
  - `components/dashboard/jobs/ui.tsx` — `Button`, `Checkbox`, `Chip`, `CustomSelect`, `GOLD`, `Label`, `Modal`, `SwitchControl`, … +6
  - `components/dashboard/jobs/shared/FormRenderer.tsx` — `FormRenderer (default)`, `AnswerMap`
  - `components/dashboard/jobs/types.ts` — `FieldCondition`, `FormField`, `FormPage`, `JobFieldType`, `Knockout`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/JobWizard.tsx` — `StepProps`, `(types only)`
  - `components/dashboard/jobs/founder/wizard/StepBasics.tsx` — `StepHeading`
- **Packages:**
  - `react`
  - `@dnd-kit/core` — `DndContext`, `PointerSensor`, `closestCenter`, `useSensor`, `useSensors`, `DragEndEvent`
  - `@dnd-kit/sortable` — `SortableContext`, `arrayMove`, `useSortable`, `verticalListSortingStrategy`
  - `@dnd-kit/utilities` — `CSS`
  - `lucide-react` — `Copy`, `Eye`, `GripVertical`, `LayoutTemplate`, `Lock`, `Monitor`, …
  - `sonner` — `toast`

## Used by

- `components/dashboard/jobs/founder/wizard/JobWizard.tsx`
