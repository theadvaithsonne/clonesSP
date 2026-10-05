# `components/deals/cms/LeadFormBuilderModal.tsx`

> React component `LeadFormBuilderModal`.

**Kind:** React component · **Lines:** 476 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Type`×2 (lucide-react), `User` (lucide-react), `Mail` (lucide-react), `Phone` (lucide-react), `Building2` (lucide-react), `Briefcase` (lucide-react), `Factory` (lucide-react), `MapPin` (lucide-react), `Globe` (lucide-react), `List` (lucide-react), `Hash` (lucide-react), `Calendar` (lucide-react), `GripVertical` (lucide-react), `Pencil` (lucide-react), `Trash2` (lucide-react), `X` (lucide-react), `DndContext` (@dnd-kit/core), `SortableContext` (@dnd-kit/sortable), `SortableFieldRow` (local)

### Props

- **`LeadFormBuilderModal`**: `open: boolean`, `form: CmsForm | null`, `onClose: () => void`, `onSave: (next: CmsForm) => Promise<void> | void`

**Hooks used:** `useState`×4, `useSortable` (@dnd-kit/sortable), `useEffect`, `useSensors` (@dnd-kit/core), `useSensor` (@dnd-kit/core)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LeadFormBuilderModal)` | component | `LeadFormBuilderModal({ open, form, onClose, onSave, }: { open: boolean; form: Cm…)` | 186 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/cms/types.ts` — `CmsForm`, `CmsFormField`, `CmsFormFieldType`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `@dnd-kit/core` — `DndContext`, `PointerSensor`, `closestCenter`, `useSensor`, `useSensors`, `DragEndEvent`
  - `@dnd-kit/sortable` — `SortableContext`, `arrayMove`, `useSortable`, `verticalListSortingStrategy`
  - `@dnd-kit/utilities` — `CSS`
  - `lucide-react` — `X`, `GripVertical`, `Pencil`, `Trash2`, `User`, `Mail`, …

## Used by

- `components/deals/cms/PageBuilderShell.tsx`
