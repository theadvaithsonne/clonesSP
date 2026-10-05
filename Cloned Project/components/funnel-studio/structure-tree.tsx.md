# `components/funnel-studio/structure-tree.tsx`

> React component `StructureTree`.

**Kind:** React component · **Lines:** 269 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `IconBtn`×4 (local), `HelpCircle`×2 (lucide-react), `TreeLevel`×2 (local), `Plus`×2 (lucide-react), `AddButton` (local), `NodeRow` (local), `Film` (lucide-react), `MessageSquareText` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Trash2` (lucide-react)

### Props

- **`StructureTree`**: `template: FunnelTemplate`, `onAddOption: () => void`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `StructureTree` | component | `StructureTree({ template, onAddOption, ...h }: StructureTreeProps)` | 30 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/funnel-tree.ts` — `FunnelNode`, `FunnelTemplate`, `(types only)`
  - `components/funnel-studio/tree-ops.ts` — `Path`, `pathsEqual`
- **Packages:**
  - `framer-motion` — `motion`
  - `lucide-react` — `ChevronDown`, `ChevronUp`, `Film`, `HelpCircle`, `Plus`, `Trash2`, …

## Used by

- `components/funnel-studio/funnel-studio.tsx`
