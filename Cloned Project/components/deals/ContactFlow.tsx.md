# `components/deals/ContactFlow.tsx`

> React component `ContactFlow`.

**Kind:** React component · **Lines:** 336 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Label`×6 (components/ui/label.tsx), `Input`×5 (components/ui/input.tsx), `Button`×2 (components/ui/button.tsx), `ArrowLeft` (lucide-react), `Select` (components/ui/select.tsx), `SelectTrigger` (components/ui/select.tsx), `SelectValue` (components/ui/select.tsx), `SelectContent` (components/ui/select.tsx), `SelectItem` (components/ui/select.tsx)

### Props

- **`ContactFlow`**: `setIsAdd: (value: boolean) => void`

**Hooks used:** `useState`×11, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ContactFlow)` | component | `ContactFlow({ setIsAdd, }: { setIsAdd: (value: boolean) => void; })` | 47 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `utils/api.ts` — `authenticatedFetch`
  - `lib/api-config.ts` — `buildExternalUrl`
- **Packages:**
  - `react` — `useState`, `useEffect`
  - `lucide-react` — `ArrowLeft`
  - `sonner` — `toast`

## Used by

No other file imports this one and it has no automatic entry point — it appears unused (or is loaded dynamically by a path the import graph cannot see).
