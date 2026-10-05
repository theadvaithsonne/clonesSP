# `components/dashboard/GarageCloudSection.tsx`

> React component `GarageCloudSection`.

**Kind:** React component · **Lines:** 670 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×9 (components/ui/button.tsx), `Monitor`×4 (lucide-react), `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `AlertCircle`×3 (lucide-react), `Pause`×2 (lucide-react), `Clock`×2 (lucide-react), `RefreshCw`×2 (lucide-react), `Square`×2 (lucide-react), `CheckCircle` (lucide-react), `Plus` (lucide-react), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `Badge` (components/ui/badge.tsx), `CardContent` (components/ui/card.tsx), `ExternalLink` (lucide-react), `Play` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `RotateCcw` (lucide-react), `Trash2` (lucide-react), `Minimize2` (lucide-react)

### Props

- **`GarageCloudSection`**: `onClose?: () => void`

**Hooks used:** `useState`×8, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (GarageCloudSection)` | component | `GarageCloudSection({ onClose }: GarageCloudSectionProps)` | 47 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `lib/utils.ts` — `cn`
- **Relative imports that did not resolve to a file:** `@/lib/garage-cloud-api`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Monitor`, `Play`, `Pause`, `Square`, `RotateCcw`, `Trash2`, …

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
