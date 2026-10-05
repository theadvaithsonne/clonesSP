# `components/deals/cms/ColumnModuleEditor.tsx`

> React component `ColumnModuleEditor`.

**Kind:** React component · **Lines:** 188 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ColumnSlot` (local), `Minus` (lucide-react), `Plus` (lucide-react), `Icon` (local)

### Props

- **`ColumnModuleEditor`**: `layoutModule: CmsModule`, `selectedId?: string | null`, `onSelect?: (id: string) => void`, `onDelete?: (id: string) => void`, `onAddToColumn: (layoutId: string, columnId: string, type: CmsModuleTy…`, `onRemoveFromColumn: (layoutId: string, columnId: string, moduleId: st…`, `renderModule: (module: CmsModule) => React.ReactNode`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ColumnModuleEditor)` | component | `ColumnModuleEditor({ layoutModule, selectedId, onSelect, onDelete, onAddToColu…)` | 53 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/cms/types.ts` — `CmsColumnData`, `CmsModule`, `CmsModuleType`, `(types only)`
  - `lib/cms/moduleDefaults.ts` — `COLUMN_ADDABLE_TYPES`
  - `lib/cms/columns.ts` — `getLayoutColumns`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Plus`, `AlignLeft`, `Heading`, `Image as ImageIcon`, `RectangleHorizontal`, `Minus`, …

## Used by

- `components/deals/cms/PageRenderer.tsx`
