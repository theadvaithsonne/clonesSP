# `components/funnel-studio/funnel-studio.tsx`

> React component `FunnelStudio`.

**Kind:** React component · **Lines:** 180 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `StructureTree` (components/funnel-studio/structure-tree.tsx), `NodeInspector` (components/funnel-studio/node-inspector.tsx), `PreviewCanvas` (components/funnel-studio/preview-canvas.tsx)

### Props

- **`FunnelStudio`**: `template`, `onSave`, `uploadFn`, `endLink`, `onDirtyChange`

**Hooks used:** `useState`×3, `useEffect`, `useImperativeHandle`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FunnelStudioProps` | interface |  | 34 |
| `FunnelStudioHandle` | interface | Imperative handle so the host page's Save button can trigger a save without FunnelStudio handing its draft state (and the normalizeOrders call over it) to the page. | 50 |
| `FunnelStudio` | component | `forwardRef<FunnelStudioHandle, FunnelStudioProps>( function FunnelStudio({ template, onSa…` | 54 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/funnel-tree.ts` — `FunnelNode`, `FunnelTemplate`, `(types only)`
  - `lib/api/funnels.ts` — `FunnelLink`, `(types only)`
  - `components/funnel-studio/structure-tree.tsx` — `StructureTree`
  - `components/funnel-studio/node-inspector.tsx` — `NodeInspector`
  - `components/funnel-studio/preview-canvas.tsx` — `PreviewCanvas`
  - `components/funnel-studio/tree-ops.ts` — `Path`, `addChild`, `deleteNode`, `getNode`, `moveNode`, `newNode`, `normalizeOrders`, `pathsEqual`, … +1
- **Packages:**
  - `react` — `forwardRef`, `useEffect`, `useImperativeHandle`, `useState`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/funnels/[id]/page.tsx`
