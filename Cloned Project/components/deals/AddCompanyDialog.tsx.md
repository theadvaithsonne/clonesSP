# `components/deals/AddCompanyDialog.tsx`

> React component `AddCompanyDialog`.

**Kind:** React component · **Lines:** 251 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Input`×4 (components/ui/input.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `X` (lucide-react), `Button` (components/ui/button.tsx)

### Props

- **`AddCompanyDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `form: AddCompanyForm`, `onFormChange: (patch: Partial<AddCompanyForm>) => void`, `onSave: () => void`, `isSubmitting?: boolean`, `showSize?: boolean`, `industryAsText?: boolean`, `title?: string`, `saveLabel?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `COMPANY_SIZE_OPTIONS` | const | `= [ "1-10", "10-50", "50-100", "100-500", "500-1000", "1000+", ]` | 20 |
| `COMPANY_INDUSTRY_OPTIONS` | const | `= [ "Technology", "Healthcare", "Finance", "Retail", "Manufacturing", "Education", "Real …` | 29 |
| `AddCompanyForm` | type |  | 41 |
| `AddCompanyDialog` | component | `AddCompanyDialog({ open, onOpenChange, form, onFormChange, onSave, isSubmitt…)` | 70 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogTitle`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/input.tsx` — `Input`
  - `components/deals/LeadDetailFigmaView.tsx` — `FIGMA`
- **Packages:**
  - `lucide-react` — `X`

## Used by

- `app/(dashboard)/deals/leads/[id]/page.tsx`
