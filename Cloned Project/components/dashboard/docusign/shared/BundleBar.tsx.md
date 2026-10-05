# `components/dashboard/docusign/shared/BundleBar.tsx`

> React component `BundleBar`.

**Kind:** React component · **Lines:** 69 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Layers` (lucide-react), `CheckCircle2` (lucide-react), `Circle` (lucide-react), `StatusBadge` (components/dashboard/docusign/shared/StatusBadge.tsx), `Loader2` (lucide-react)

### Props

- **`BundleBar`**: `documents: DsBundleMember[]`, `currentId: string`, `currentReady?: boolean`, `onSelect: (documentId: string) => void`, `busy?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BundleBar` | component | `BundleBar({ documents, currentId, currentReady, onSelect, busy }: Bun…)` | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/dashboard/docusign/shared/StatusBadge.tsx` — `StatusBadge`
  - `lib/docusign/types.ts` — `DsBundleMember`, `(types only)`
- **Packages:**
  - `lucide-react` — `CheckCircle2`, `Circle`, `Layers`, `Loader2`

## Used by

- `components/dashboard/docusign/external/ExternalFieldEditorView.tsx`
- `components/dashboard/docusign/internal/FieldEditorView.tsx`
