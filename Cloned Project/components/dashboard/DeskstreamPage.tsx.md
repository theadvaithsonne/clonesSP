# `components/dashboard/DeskstreamPage.tsx`

> React component `DeskstreamPage`.

**Kind:** React component · **Lines:** 704 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×12 (components/ui/button.tsx), `Monitor`×5 (lucide-react), `DropdownMenuItem`×4 (components/ui/dropdown-menu.tsx), `AlertCircle`×3 (lucide-react), `Pause`×2 (lucide-react), `Clock`×2 (lucide-react), `RefreshCw`×2 (lucide-react), `Card`×2 (components/ui/card.tsx), `CardHeader`×2 (components/ui/card.tsx), `CardContent`×2 (components/ui/card.tsx), `ExternalLink`×2 (lucide-react), `Square`×2 (lucide-react), `CheckCircle` (lucide-react), `Grid3X3` (lucide-react), `AppIcon` (components/dashboard/AppIcon.tsx), `Globe` (lucide-react), `Plus` (lucide-react), `Badge` (components/ui/badge.tsx), `Play` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `RotateCcw` (lucide-react), `Trash2` (lucide-react), `Minimize2` (lucide-react)

### Props

- **`DeskstreamPage`**: `onClose?: () => void`

**Hooks used:** `useState`×10, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DeskstreamPage)` | component | `DeskstreamPage({ onClose }: DeskstreamPageProps)` | 55 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/apps/my?orgId=${orgId}` (L91)
- **Browser storage / cookies:** `garage_org_id` (localStorage: get)

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardHeader`, `CardTitle`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogHeader`, `DialogTitle`, `DialogTrigger`
  - `lib/utils.ts` — `cn`
  - `lib/kasm-api.ts` — `kasmApi`, `KasmSession`
  - `lib/api.ts` — `api`
  - `lib/auth.ts` — `getToken`
  - `components/dashboard/AppIcon.tsx` — `AppIcon (default)`
  - `components/dashboard/Marketplace.tsx` — `CATALOG`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `Monitor`, `Play`, `Pause`, `Square`, `RotateCcw`, `Trash2`, …

## Used by

- `app/(dashboard)/layout.tsx`
