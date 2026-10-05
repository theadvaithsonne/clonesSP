# `components/dashboard/DescriptionEditor.tsx`

> React component `DescriptionEditor`.

**Kind:** React component · **Lines:** 422

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link2`×3 (lucide-react), `Bold` (lucide-react), `Italic` (lucide-react), `Underline` (lucide-react), `List` (lucide-react), `Check` (lucide-react), `X` (lucide-react), `ExternalLink` (lucide-react), `Pencil` (lucide-react), `Unlink` (lucide-react)

### Props

- **`DescriptionEditor`**: `value: string`, `onChange: (value: string) => void`, `placeholder?: string`

**Hooks used:** `useRef`×6, `useCallback`×6, `useState`×5, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DescriptionEditor)` | component | `DescriptionEditor({ value, onChange, placeholder, }: DescriptionEditorProps)` | 41 |

## Interfaces

- **Timers / queues:** `setTimeout` at L260

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useRef`, `useEffect`, `useState`, `useCallback`
  - `lucide-react` — `Bold`, `Italic`, `Underline`, `Link2`, `List`, `X`, …

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/InstantLiveStreamModal.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/WorkshopsPage.tsx`
