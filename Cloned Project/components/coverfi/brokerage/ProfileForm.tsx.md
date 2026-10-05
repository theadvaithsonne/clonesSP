# `components/coverfi/brokerage/ProfileForm.tsx`

> React component `ProfileForm`.

**Kind:** React component · **Lines:** 228 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×10 (local), `Input`×7 (components/ui/input.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `Textarea` (components/ui/textarea.tsx), `Button` (components/ui/button.tsx), `Label` (components/ui/label.tsx)

**Hooks used:** `useState`×3, `useMemo`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ProfileForm)` | component | `ProfileForm()` | 41 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/textarea.tsx` — `Textarea`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `lib/coverfi/brokerage-api.ts` — `getBrokerage`, `patchBrokerageProfile`
  - `lib/coverfi/types.ts` — `Brokerage`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useState`
  - `country-state-city` — `Country`, `State`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/brokerage/page.tsx`
