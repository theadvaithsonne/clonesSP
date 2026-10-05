# `components/crm/ViewFunnelDialog.tsx`

> React component `ViewFunnelDialog`.

**Kind:** React component · **Lines:** 271 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×7 (components/ui/label.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx), `Button` (components/ui/button.tsx)

### Props

- **`ViewFunnelDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `viewingFunnel: any | null`, `isLoading: boolean`

**Hooks used:** `useTheme` (next-themes), `useDealsTheme` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ViewFunnelDialog)` | component | `ViewFunnelDialog({ open, onOpenChange, viewingFunnel, isLoading, }: ViewFunn…)` | 85 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/label.tsx` — `Label`
  - `lib/deals-events.ts` — `isDealsInlineMode`
- **Packages:**
  - `next-themes` — `useTheme`

## Used by

- `app/(dashboard)/deals/companies/page.tsx`
- `app/(dashboard)/deals/contacts/page.tsx`
- `app/(dashboard)/deals/funnel/page.tsx`
- `app/(dashboard)/deals/products/page.tsx`
