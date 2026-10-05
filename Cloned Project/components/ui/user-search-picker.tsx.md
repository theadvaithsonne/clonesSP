# `components/ui/user-search-picker.tsx`

> React component `UserSearchPicker`.

**Kind:** UI primitive (shadcn/Radix wrapper) · **Lines:** 199 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `X` (lucide-react), `Search` (lucide-react), `Loader2` (lucide-react)

### Props

- **`UserSearchPicker`**: `scope: "platform" | "org"`, `orgId?: string`, `authToken?: string`, `selected: PickedUser[]`, `onChange: (users: PickedUser[]) => void`, `placeholder?: string`, `className?: string`, `disabled?: boolean`

**Hooks used:** `useState`×4, `useRef`×2, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `PickedUser` | interface |  | 9 |
| `UserSearchPicker` | component | `UserSearchPicker({ scope, orgId, authToken, selected, onChange, placeholder …)` | 28 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/${path}?q=${encodeURIComponent(query.trim())}&limit=10` (L59)
- **Timers / queues:** `setTimeout` at L56

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `lib/api.ts` — `API_URL`
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`
  - `lucide-react` — `Loader2`, `Search`, `X`

## Used by

- `components/dashboard/CouponAssignmentSheet.tsx`
