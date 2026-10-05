# `components/ui/country-name-picker.tsx`

> A searchable country **name** select.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 158 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
A searchable country **name** select.

Distinct from `country-code-picker.tsx`, which selects a dial code for a
phone field. This one is for address forms: the value is the plain country
name string ("India"), because that is what `/org/resolve-pincode` returns
and what the org record stores — swapping to ISO codes would strand every
address already saved.

A free-typed country that is not in the list is preserved rather than
blanked: existing records hold hand-entered spellings, and silently
dropping one on open would lose it the next time the form is saved.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Globe` (lucide-react), `ChevronDown` (lucide-react), `Search` (lucide-react)

### Props

- **`CountryNamePicker`**: `value: string`, `onChange: (name: string) => void`, `placeholder?: string`, `disabled?: boolean`, `id?: string`, `className?: string`, `hideIcon?: boolean`

**Hooks used:** `useMemo`×3, `useState`×2, `useRef`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `CountryNamePickerProps` | interface |  | 22 |
| `CountryNamePicker` | component | `CountryNamePicker({ value, onChange, placeholder = "Select country", disabled…)` | 34 |
| `default (CountryNamePicker)` | component | `CountryNamePicker({ value, onChange, placeholder = "Select country", disabled…)` | 157 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:**
  - `react` — `useEffect`, `useMemo`, `useRef`, `useState`
  - `country-state-city` — `Country`
  - `lucide-react` — `ChevronDown`, `Globe`, `Search`

## Used by

- `components/shared/ManageOrgPopover.tsx`
