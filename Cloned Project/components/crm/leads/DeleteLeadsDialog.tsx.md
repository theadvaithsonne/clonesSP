# `components/crm/leads/DeleteLeadsDialog.tsx`

> React component `DeleteLeadsDialog`.

**Kind:** React component · **Lines:** 208 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx)

### Props

- **`DeleteLeadsDialog`**: `open: boolean`, `onOpenChange: (open: boolean) => void`, `leads: DeleteLeadItem[]`, `totalCount?: number`, `remainingCount?: number`, `onConfirm: () => void`, `isDeleting?: boolean`, `title?: string`, `description?: string`, `selectedLabel?: string`

**Hooks used:** `useTheme` (next-themes), `useDealsTheme` (local)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DeleteLeadItem` | type |  | 11 |
| `default (DeleteLeadsDialog)` | component | `DeleteLeadsDialog({ open, onOpenChange, leads, totalCount, remainingCount = 0…)` | 94 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`
  - `lib/deals-events.ts` — `isDealsInlineMode`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `next-themes` — `useTheme`

## Used by

- `app/(dashboard)/deals/companies/page.tsx`
- `app/(dashboard)/deals/contacts/page.tsx`
- `app/(dashboard)/deals/funnel/page.tsx`
- `app/(dashboard)/deals/leads/[id]/page.tsx`
- `app/(dashboard)/deals/leads/page.tsx`
- `app/(dashboard)/deals/products/page.tsx`
