# `components/deals/EditLeadProfileDialog.tsx`

> React component `EditLeadProfileDialog`.

**Kind:** React component · **Lines:** 552 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `SelectItem`×15 (components/ui/select.tsx), `Select`×6 (components/ui/select.tsx), `SelectTrigger`×6 (components/ui/select.tsx), `SelectValue`×6 (components/ui/select.tsx), `SelectContent`×6 (components/ui/select.tsx), `X`×3 (lucide-react), `Button`×3 (components/ui/button.tsx), `Plus`×3 (lucide-react), `Input`×2 (components/ui/input.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `Loader2` (lucide-react), `Textarea` (components/ui/textarea.tsx), `Tag` (lucide-react), `Archive` (lucide-react), `XCircle` (lucide-react), `Trophy` (lucide-react)

### Props

- **`EditLeadProfileDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `form: EditLeadProfileForm`, `onFormChange: (patch: Partial<EditLeadProfileForm>) => void`, `funnels: FunnelOption[]`, `stages: string[]`, `sources: string[]`, `users: UserOption[]`, `isLoading?: boolean`, `isSubmitting?: boolean`, `isCustomSource?: boolean`, `customSourceValue?: string`, `onCustomSourceChange?: (value: string) => void`, `onToggleCustomSource?: (enabled: boolean) => void`, `onFunnelChange: (funnelId: string) => void`, `onSave: () => void`, `leadStatus?: string`, `onAddTag?: (tag: string) => void`, `onRemoveTag?: (tag: string) => void`, `currentTags?: string[]`, `onArchive?: () => void`, `onCloseLost?: () => void`, `onMarkWon?: () => void`, `onMakeActive?: () => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `EditLeadProfileForm` | type |  | 22 |
| `EditLeadProfileDialog` | component | `EditLeadProfileDialog({ open, onOpenChange, form, onFormChange, funnels, stages, …)` | 64 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/deals/LeadDetailFigmaView.tsx` — `FIGMA`
- **Packages:**
  - `lucide-react` — `Archive`, `Loader2`, `Plus`, `Tag`, `Trophy`, `X`, …
  - `react` — `useState`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/page.tsx`
