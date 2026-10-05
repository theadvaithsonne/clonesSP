# `components/deals/AddTagDialog.tsx`

> React component `AddTagDialog`.

**Kind:** React component · **Lines:** 172 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X`×2 (lucide-react), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx)

### Props

- **`AddTagDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `tagInput: string`, `onTagInputChange: (value: string) => void`, `currentTags: string[]`, `getTagColor: (tag: string, index: number) => TagColor`, `onRemoveTag: (tag: string) => void`, `onSave: () => void`, `isSubmitting?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `TagColor` | type |  | 13 |
| `AddTagDialog` | component | `AddTagDialog({ open, onOpenChange, tagInput, onTagInputChange, currentTa…)` | 35 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/deals/LeadDetailFigmaView.tsx` — `FIGMA`
- **Packages:**
  - `lucide-react` — `X`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
