# `components/dashboard/docusign/shared/PlacedField.tsx`

> React component `PlacedField`.

**Kind:** React component · **Lines:** 153 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Trash2` (lucide-react)

### Props

- **`PlacedField`**: `box: FieldBox`, `accent: string`, `editable: boolean`, `selected: boolean`, `getPageRect: () => DOMRect | null`, `onSelect: () => void`, `onChange: (patch: Partial<FieldBox>) => void`, `onRemove: () => void`, `children?: ReactNode`

**Hooks used:** `useRef`×3, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FieldBox` | interface |  | 12 |
| `PlacedField` | component | `PlacedField({ box, accent, editable, selected, getPageRect, onSelect, o…)` | 38 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useRef`, `KeyboardEvent`, `PointerEvent as ReactPointerEvent`, `ReactNode`
  - `lucide-react` — `Trash2`

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
