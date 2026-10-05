# `components/funnel-studio/tree-ops.ts`

> Pure, immutable helpers for editing the funnel tree by path.

**Kind:** React component · **Lines:** 100

<!-- docgen:auto -->

## Purpose
Pure, immutable helpers for editing the funnel tree by path.
A Path is a list of sibling indices from the root options down to a node:
  []      -> the opening question (root)
  [0]     -> first top-level option
  [0, 2]  -> third sub-option of the first option

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `Path` | type |  | 8 |
| `newNode` | function | `newNode(order: number): FunnelNode` | 10 |
| `pathsEqual` | function | `pathsEqual(a: Path \| null, b: Path \| null): boolean` | 14 |
| `getNode` | function | `getNode(tpl: FunnelTemplate, path: Path): FunnelNode \| null` | 19 |
| `updateNode` | function | `updateNode(tpl: FunnelTemplate, path: Path, updater: (n: FunnelNode) => FunnelNode): FunnelTemplate` | 31 |
| `deleteNode` | function | `deleteNode(tpl: FunnelTemplate, path: Path): FunnelTemplate` | 46 |
| `addChild` | function | `addChild(tpl: FunnelTemplate, parent: Path, child: FunnelNode): FunnelTemplate` | 54 |
| `moveNode` | function | `moveNode(tpl: FunnelTemplate, path: Path, dir: "up" \| "down"): FunnelTemplate` | 63 |
| `normalizeOrders` | function | `normalizeOrders(tpl: FunnelTemplate): FunnelTemplate` — Reassign `order` to match array position, recursively (called before save). | 82 |
| `countVideosDeep` | function | `countVideosDeep(node: FunnelNode): number` — How many videos exist anywhere under a node (for structure badges). | 94 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/funnel-tree.ts` — `FunnelNode`, `FunnelTemplate`, `(types only)`
- **Packages:** none

## Used by

- `components/funnel-studio/funnel-studio.tsx`
- `components/funnel-studio/node-inspector.tsx`
- `components/funnel-studio/preview-canvas.tsx`
- `components/funnel-studio/structure-tree.tsx`
