# `components/deals/CompanyFlow.tsx`

> React component `CompanyFlow`.

**Kind:** React component · **Lines:** 395 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×8 (components/ui/label.tsx), `Input`×5 (components/ui/input.tsx), `Button`×3 (components/ui/button.tsx), `Select`×3 (components/ui/select.tsx), `SelectTrigger`×3 (components/ui/select.tsx), `SelectValue`×3 (components/ui/select.tsx), `SelectContent`×3 (components/ui/select.tsx), `SelectItem`×3 (components/ui/select.tsx), `ArrowLeft` (lucide-react)

### Props

- **`CompanyFlow`**: `setIsAdd: (value: boolean) => void`

**Hooks used:** `useState`×14, `useLocationStore` (store/locationStore.tsx), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CompanyFlow)` | component | `CompanyFlow({ setIsAdd, }: { setIsAdd: (value: boolean) => void; })` | 20 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `store/locationStore.tsx` — `useLocationStore`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `ArrowLeft`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
