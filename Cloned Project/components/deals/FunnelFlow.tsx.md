# `components/deals/FunnelFlow.tsx`

> React component `FunnelFlow`.

**Kind:** React component · **Lines:** 947 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×8 (components/ui/button.tsx), `Label`×6 (components/ui/label.tsx), `Input`×4 (components/ui/input.tsx), `SelectItem`×2 (components/ui/select.tsx), `Plus`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `Eye`×2 (lucide-react), `AlertTriangle` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `GripVertical` (lucide-react), `Textarea` (components/ui/textarea.tsx), `Trash2` (lucide-react), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogDescription` (components/ui/dialog.tsx), `Badge` (components/ui/badge.tsx), `DialogFooter` (components/ui/dialog.tsx), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogCancel` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx), `X` (lucide-react), `ArrowLeft` (lucide-react)

### Props

- **`FunnelFlow`**: `setIsAdd: (value: boolean) => void`, `editingFunnel?: any`, `onCancel?: () => void`, `asDialog?: boolean`

**Hooks used:** `useState`×18, `useRef`×4, `useEffect`×2, `useTheme` (next-themes)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (FunnelFlow)` | component | `FunnelFlow({ setIsAdd, editingFunnel, onCancel, asDialog = false, }: {…)` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/badge.tsx` — `Badge`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `lib/deals-events.ts` — `isDealsInlineMode`
  - `utils/api.ts` — `authenticatedFetch`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogCancel`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`
  - `lucide-react` — `ArrowLeft`, `ArrowRight`, `X`, `Plus`, `Trash2`, `Cog`, …
  - `next-themes` — `useTheme`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/deals/funnel/page.tsx`
