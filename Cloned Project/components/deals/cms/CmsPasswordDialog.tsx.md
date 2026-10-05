# `components/deals/cms/CmsPasswordDialog.tsx`

> React component `CmsPasswordDialog`.

**Kind:** React component · **Lines:** 127 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `X` (lucide-react), `Input` (components/ui/input.tsx), `Button` (components/ui/button.tsx)

### Props

- **`CmsPasswordDialog`**: `open: boolean`, `error?: string`, `isSubmitting?: boolean`, `onOpenChange: (open: boolean) => void`, `onSubmit: (password: string) => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CmsPasswordDialog` | component | `CmsPasswordDialog({ open, error, isSubmitting = false, onOpenChange, onSubmit…)` | 18 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/deals/LeadDetailFigmaView.tsx` — `FIGMA`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `X`

## Used by

- `components/deals/cms/CmsAccessGateHost.tsx`
- `components/deals/cms/CmsPageAccessGuard.tsx`
