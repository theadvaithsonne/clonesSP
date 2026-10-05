# `components/crm/DealsPageToolbar.tsx`

> React components `DealsPageToolbar`, `DealsSearchField`.

**Kind:** React component · **Lines:** 54 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`DealsPageToolbar`**: `search: React.ReactNode`, `actions: React.ReactNode`, `className?: string`
- **`DealsSearchField`**: `children: React.ReactNode`, `className?: string`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DealsPageToolbar` | component | `DealsPageToolbar({ search, actions, className, }: DealsPageToolbarProps)` — Responsive wrapper for Deals list-page toolbars (search + action buttons). | 12 |
| `DealsSearchField` | component | `DealsSearchField({ children, className }: DealsSearchFieldProps)` — Search input container - full width on mobile, fixed width on sm+. | 43 |
| `dealsToolbarActionBtn` | const | `= "h-8 w-8 p-0 sm:h-[32px] sm:w-auto sm:px-[10px] shrink-0 flex items-center justify-cent…` — Icon-only on mobile, label on sm+ for toolbar action buttons. | 52 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
- **Packages:** none

## Used by

- `app/(dashboard)/deals/companies/page.tsx`
- `app/(dashboard)/deals/contacts/page.tsx`
