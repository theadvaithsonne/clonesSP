# `components/deals/AddContactDialog.tsx`

> React component `AddContactDialog`.

**Kind:** React component · **Lines:** 193 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `X` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react), `Button` (components/ui/button.tsx)

### Props

- **`AddContactDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `contacts: AddContactProfile[]`, `selectedIds: string[]`, `searchQuery: string`, `onSearchChange: (query: string) => void`, `onToggleContact: (contactId: string) => void`, `onSave: () => void`, `isLoading?: boolean`, `isSubmitting?: boolean`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `AddContactProfile` | type |  | 12 |
| `AddContactDialog` | component | `AddContactDialog({ open, onOpenChange, contacts, selectedIds, searchQuery, o…)` | 32 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `components/deals/LeadDetailFigmaView.tsx` — `FIGMA`
- **Packages:**
  - `lucide-react` — `Loader2`, `Search`, `X`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
