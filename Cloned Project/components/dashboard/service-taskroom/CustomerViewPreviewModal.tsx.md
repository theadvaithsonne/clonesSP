# `components/dashboard/service-taskroom/CustomerViewPreviewModal.tsx`

> "Preview customer view" — shows the founder exactly what a client will and will not see for the current Section 6 configuration.

**Kind:** React component · **Lines:** 400 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
"Preview customer view" — shows the founder exactly what a client will and
will not see for the current Section 6 configuration.

This applies the same rules the server-side board proxy applies: internal
columns and internal tasks are dropped entirely, and each disabled module is
shown as withheld. It is a simulator over local wizard state, so it never
calls Taskroom — but the rules it mirrors are the ones actually enforced.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `EyeOff`×4 (lucide-react), `Icon`×3 (local), `X` (lucide-react), `ListChecks` (lucide-react), `KanbanSquare` (lucide-react), `Folder` (lucide-react), `Activity` (lucide-react)

### Props

- **`CustomerViewPreviewModal`**: `open: boolean`, `onClose: () => void`, `config: ServiceTaskroomConfig`, `serviceTitle: string`

**Hooks used:** `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CustomerViewPreviewModal` | component | `CustomerViewPreviewModal({ open, onClose, config, serviceTitle, }: { open: boolean; …)` | 38 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/feed-api.ts` — `ServiceClientAccess`, `ServiceTaskroomConfig`, `(types only)`
- **Packages:**
  - `react` — `useMemo`
  - `react-dom` — `createPortal`
  - `lucide-react` — `Activity`, `CreditCard`, `EyeOff`, `FileText`, `Folder`, `FolderOpen`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
