# `app/careers/components/CreateVacancyDialog.tsx`

> React component `CreateVacancyDialog`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 261 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×8 (components/ui/label.tsx), `SelectItem`×7 (components/ui/select.tsx), `Input`×4 (components/ui/input.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `RichTextEditor` (components/ui/rich-text-editor.tsx), `Textarea` (components/ui/textarea.tsx), `Loader2` (lucide-react)

### Props

- **`CreateVacancyDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `onCreated: () => void`, `editVacancy?: Vacancy | null`, `createVacancy: ( data: Omit<Vacancy, "_id" | "orgId" | "createdAt" | …`, `updateVacancy: ( id: string, data: Partial<Vacancy> ) => Promise<Vaca…`

**Hooks used:** `useState`×9, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CreateVacancyDialog)` | component | `CreateVacancyDialog({ open, onOpenChange, onCreated, editVacancy, createVacancy…)` | 40 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/rich-text-editor.tsx` — `RichTextEditor`
  - `app/careers/types.ts` — `Vacancy`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Loader2`
  - `sonner` — `toast`

## Used by

- `app/careers/CareersClient.tsx`
