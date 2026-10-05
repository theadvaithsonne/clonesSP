# `components/deals/NewLeadFlow.tsx`

> React component `NewLeadFlow`.

**Kind:** React component · **Lines:** 2641 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×43 (components/ui/label.tsx), `Input`×35 (components/ui/input.tsx), `SelectItem`×21 (components/ui/select.tsx), `Button`×15 (components/ui/button.tsx), `Select`×6 (components/ui/select.tsx), `SelectTrigger`×6 (components/ui/select.tsx), `SelectValue`×6 (components/ui/select.tsx), `SelectContent`×6 (components/ui/select.tsx), `TabsContent`×5 (components/ui/tabs.tsx), `ArrowRight`×5 (lucide-react), `TabsTrigger`×4 (components/ui/tabs.tsx), `Plus`×3 (lucide-react), `Search`×2 (lucide-react), `Checkbox`×2 (components/ui/checkbox.tsx), `UploadCloud`×2 (lucide-react), `Download`×2 (lucide-react), `X`×2 (lucide-react), `Dialog`×2 (components/ui/dialog.tsx), `DialogContent`×2 (components/ui/dialog.tsx), `DialogHeader`×2 (components/ui/dialog.tsx), `DialogTitle`×2 (components/ui/dialog.tsx), `DialogDescription`×2 (components/ui/dialog.tsx), `DialogFooter`×2 (components/ui/dialog.tsx), `ArrowLeft` (lucide-react), `Tabs` (components/ui/tabs.tsx), `TabsList` (components/ui/tabs.tsx), `Mail` (lucide-react), `Calendar` (lucide-react), `Phone` (lucide-react), `AlertDialog` (components/ui/alert-dialog.tsx), `AlertDialogContent` (components/ui/alert-dialog.tsx), `AlertDialogHeader` (components/ui/alert-dialog.tsx), `AlertDialogTitle` (components/ui/alert-dialog.tsx), `AlertDialogDescription` (components/ui/alert-dialog.tsx), `AlertDialogFooter` (components/ui/alert-dialog.tsx), `AlertDialogAction` (components/ui/alert-dialog.tsx)

### Props

- **`NewLeadFlow`**: `setIsAdd: (value: boolean) => void`, `editLead?: any`

**Hooks used:** `useState`×45, `useEffect`×8, `useUploadThing`×2 (utils/uploadthing.ts)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (NewLeadFlow)` | component | `NewLeadFlow({ setIsAdd, editLead, }: { setIsAdd: (value: boolean) => vo…)` | 67 |

## Interfaces

- **Browser storage / cookies:** `auth-token` (localStorage: get), `auth-token` (cookie: get)
- **Timers / queues:** `setTimeout` at L1166

## Dependencies

- **Internal:**
  - `components/ui/tabs.tsx` — `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/checkbox.tsx` — `Checkbox`
  - `components/ui/popover.tsx` — `Popover`, `PopoverContent`, `PopoverTrigger`
  - `components/ui/command.tsx` — `Command`, `CommandEmpty`, `CommandGroup`, `CommandInput`, `CommandItem`, `CommandList`
  - `components/ui/alert-dialog.tsx` — `AlertDialog`, `AlertDialogAction`, `AlertDialogContent`, `AlertDialogDescription`, `AlertDialogFooter`, `AlertDialogHeader`, `AlertDialogTitle`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `utils/uploadthing.ts` — `useUploadThing`
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `ArrowLeft`, `Mail`, `Calendar`, `Phone`, `UploadCloud`, `Download`, …
  - `sonner` — `toast`
  - `js-cookie`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).

## Notes

- Large file (2641 lines) — read it by section; line numbers above point into it.
