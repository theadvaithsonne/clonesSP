# `components/coverfi/corporate/CorporateInfoTab.tsx`

> React component `CorporateInfoTab`.

**Kind:** React component · **Lines:** 256 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Field`×14 (local), `Input`×12 (components/ui/input.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `SelectItem`×2 (components/ui/select.tsx), `ImageUpload` (components/coverfi/brokerage/ImageUpload.tsx), `Button` (components/ui/button.tsx), `Label` (components/ui/label.tsx)

### Props

- **`CorporateInfoTab`**: `corporate: Corporate`, `onSaved: () => Promise<void> | void`

**Hooks used:** `useState`×2, `useMemo`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (CorporateInfoTab)` | component | `CorporateInfoTab({ corporate, onSaved }: Props)` | 25 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/button.tsx` — `Button`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/label.tsx` — `Label`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/coverfi/brokerage/ImageUpload.tsx` — `ImageUpload (default)`
  - `lib/coverfi/corporate-api.ts` — `updateCorporate`
  - `lib/coverfi/types.ts` — `Corporate`, `(types only)`
- **Packages:**
  - `react` — `useMemo`, `useState`
  - `country-state-city` — `Country`, `State`
  - `sonner` — `toast`

## Used by

- `components/coverfi/corporate/CorporateDetail.tsx`
