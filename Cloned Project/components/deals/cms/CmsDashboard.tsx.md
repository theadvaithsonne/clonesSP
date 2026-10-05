# `components/deals/cms/CmsDashboard.tsx`

> React component `CmsDashboard`.

**Kind:** React component · **Lines:** 483 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DropdownMenuItem`×9 (components/ui/dropdown-menu.tsx), `DropdownMenu`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuContent`×2 (components/ui/dropdown-menu.tsx), `DropdownMenuSeparator`×2 (components/ui/dropdown-menu.tsx), `Copy`×2 (lucide-react), `Trash2`×2 (lucide-react), `Search` (lucide-react), `ChevronDown` (lucide-react), `Plus` (lucide-react), `MoreHorizontal` (lucide-react), `Globe` (lucide-react), `Pencil` (lucide-react), `Eye` (lucide-react), `DomainSettingsModal` (components/deals/cms/DomainSettingsModal.tsx), `X` (lucide-react)

### Props

- **`CmsDashboard`**: `onOpenBuilder: (pageId: string) => void`

**Hooks used:** `useState`×10, `useEffect`×2, `useCallback`, `useDealsInlineRefresh` (lib/deals-events.ts), `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CmsDashboard)` | component | `CmsDashboard({ onOpenBuilder, }: { onOpenBuilder: (pageId: string) => vo…)` | 60 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/cms/api.ts` — `cloneCmsPage`, `createCmsPage`, `deleteCmsPage`, `listCmsPages`, `updateCmsPageStatus`
  - `lib/cms/types.ts` — `CmsPage`, `(types only)`
  - `lib/deals-events.ts` — `useDealsInlineRefresh`
  - `components/deals/cms/DomainSettingsModal.tsx` — `DomainSettingsModal (default)`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `ChevronDown`, `Copy`, `Eye`, `Globe`, `MoreHorizontal`, `Pencil`, …
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/deals/cms/page.tsx`
