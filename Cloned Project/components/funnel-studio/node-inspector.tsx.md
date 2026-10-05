# `components/funnel-studio/node-inspector.tsx`

> React component `NodeInspector`.

**Kind:** React component · **Lines:** 453 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×6 (components/ui/input.tsx), `SectionLabel`×5 (local), `MessageSquareText`×2 (lucide-react), `Trash2`×2 (lucide-react), `UserPlus`×2 (lucide-react), `Textarea` (components/ui/textarea.tsx), `Plus` (lucide-react), `VideoRow` (local), `UploadButton` (local), `YouTubeAddRow` (local), `Film` (lucide-react), `ChevronUp` (lucide-react), `ChevronDown` (lucide-react), `Loader2` (lucide-react), `Upload` (lucide-react), `Youtube` (lucide-react)

### Props

- **`NodeInspector`**: `selected: Path | null`, `node: FunnelNode | null`, `rootQuestion: string`, `onRootQuestion: (v: string) => void`, `onPatch: (patch: Partial<FunnelNode>) => void`, `uploadFn: (file: File) => Promise<{ key: string; publicUrl: string }>`

**Hooks used:** `useState`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NodeInspector` | component | `NodeInspector({ selected, node, rootQuestion, onRootQuestion, onPatch, up…)` | 33 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `lib/utils.ts` — `cn`
  - `lib/funnel-tree.ts` — `FunnelNode`, `FunnelVideo`, `(types only)`
  - `components/funnel-studio/tree-ops.ts` — `Path`, `(types only)`
  - `lib/youtube.ts` — `parseYouTubeId`, `youTubeThumb`
- **Packages:**
  - `react` — `useRef`, `useState`
  - `sonner` — `toast`
  - `lucide-react` — `ChevronDown`, `ChevronUp`, `Film`, `Loader2`, `Plus`, `Trash2`, …

## Used by

- `components/funnel-studio/funnel-studio.tsx`
