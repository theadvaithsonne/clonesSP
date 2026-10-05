# `components/ui/rich-text-editor.tsx`

> React component `RichTextEditor`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 706 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ToolbarButton`×11 (local), `LinkIcon`×2 (lucide-react), `Icon` (local), `Check` (lucide-react), `X` (lucide-react), `ExternalLink` (lucide-react), `Pencil` (lucide-react), `Unlink` (lucide-react)

### Props

- **`RichTextEditor`**: `value: string`, `onChange: (value: string) => void`, `placeholder?: string`, `className?: string`, `minHeight?: string`, `theme?: RichTextEditorTheme`

**Hooks used:** `useCallback`×11, `useRef`×7, `useState`×5, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `RichTextEditorTheme` | type | Which palette the chrome uses. | 36 |
| `RichTextEditor` | component | `RichTextEditor({ value, onChange, placeholder = "Start typing...", classNa…)` | 154 |

## Interfaces

- **Timers / queues:** `setTimeout` at L305

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useRef`, `useCallback`, `useEffect`
  - `lucide-react` — `Bold`, `Italic`, `Underline`, `List`, `ListOrdered`, `Link as LinkIcon`, …

## Used by

- `app/careers/components/CreateVacancyDialog.tsx`
- `components/coverfi/communication/TemplateEditor.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/TestimonialsPage.tsx`
- `components/dashboard/jobs/founder/wizard/StepDescription.tsx`
- `components/garage-admin/AnnouncementsConsole.tsx`
