# `components/dashboard/drops/DeleteConfirmModal.tsx`

> React component `DeleteConfirmModal`.

**Kind:** React component · **Lines:** 95 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `Trash2` (lucide-react)

### Props

- **`DeleteConfirmModal`**: `isOpen: boolean`, `title?: string`, `message?: string`, `onConfirm: () => void`, `onCancel: () => void`, `isDeleting?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DeleteConfirmModal)` | component | `DeleteConfirmModal({ isOpen, title = "Delete this drop?", message = "This can'…)` | 14 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `lucide-react` — `Trash2`, `Loader2`

## Used by

- `components/dashboard/drops/AllDropsTab.tsx`
- `components/dashboard/drops/MyUploadsTab.tsx`
