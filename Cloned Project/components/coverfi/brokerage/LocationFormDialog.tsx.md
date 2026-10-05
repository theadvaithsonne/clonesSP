# `components/coverfi/brokerage/LocationFormDialog.tsx`

> React component `LocationFormDialog`.

**Kind:** React component · **Lines:** 205 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×5 (components/ui/label.tsx), `Input`×3 (components/ui/input.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Button`×2 (components/ui/button.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `DialogFooter` (components/ui/dialog.tsx)

### Props

- **`LocationFormDialog`**: `open: boolean`, `onClose: () => void`, `onSaved: () => void`, `existing?: BrokerageLocation | null`

**Hooks used:** `useState`×2, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (LocationFormDialog)` | component | `LocationFormDialog({ open, onClose, onSaved, existing, }: Props)` | 44 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogFooter`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/coverfi/brokerage-api.ts` — `createLocation`, `updateLocation`
  - `lib/coverfi/types.ts` — `BrokerageLocation`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `country-state-city` — `Country`, `State`
  - `sonner` — `toast`

## Used by

- `components/coverfi/brokerage/LocationsTable.tsx`
