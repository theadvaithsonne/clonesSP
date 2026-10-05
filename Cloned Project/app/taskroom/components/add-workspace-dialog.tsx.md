# `app/taskroom/components/add-workspace-dialog.tsx`

> React component `AddWorkspaceDialog`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 200 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Logo` (local), `Input` (components/ui/input.tsx), `ChevronLeft` (lucide-react), `Check` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`AddWorkspaceDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`

**Hooks used:** `useState`×8, `useWorkspaceStore` (store/taskroom/workspaceStore.ts), `useTemplateStore` (store/taskroom/templateStore.ts), `useRouter` (next/navigation)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AddWorkspaceDialog` | component | `AddWorkspaceDialog({ open, onOpenChange, }: { open: boolean; onOpenChange: (op…)` | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `lib/utils.ts` — `cn`
  - `components/ui/badge.tsx` — `Badge`
  - `store/taskroom/workspaceStore.ts` — `useWorkspaceStore`
  - `store/taskroom/templateStore.ts` — `useTemplateStore`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `Check`, `X`, `AlertCircle`
  - `next` — `useRouter`

## Used by

- `app/taskroom/Layout.tsx`
