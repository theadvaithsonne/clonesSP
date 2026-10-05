# `components/offices/OfficesTopBar.tsx`

> React component `OfficesTopBar`.

**Kind:** React component · **Lines:** 200 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Search`×2 (lucide-react), `PillButton`×2 (components/offices/ui.tsx), `DropdownMenuItem`×2 (components/ui/dropdown-menu.tsx), `Image` (next/image), `Building2` (lucide-react), `Plus` (lucide-react), `DropdownMenu` (components/ui/dropdown-menu.tsx), `DropdownMenuTrigger` (components/ui/dropdown-menu.tsx), `DropdownMenuContent` (components/ui/dropdown-menu.tsx), `DropdownMenuLabel` (components/ui/dropdown-menu.tsx), `DropdownMenuSeparator` (components/ui/dropdown-menu.tsx), `ArrowLeft` (lucide-react), `LogOut` (lucide-react), `OfficeSearchPalette` (components/offices/OfficeSearchPalette.tsx)

### Props

- **`OfficesTopBar`**: `user: { name?: string; email: string; profilePicture?: string }`, `categories: DiscoverCategory[]`, `searchQuery: string`, `onOpenOffice: (office: DiscoverOffice) => void`, `onSearch: (q: string) => void`, `onSelectCategory: (category: string) => void`, `onHome: () => void`, `onCreateOffice: () => void`, `onMyOffices: () => void`, `myOfficesActive: boolean`, `myOfficeCount: number`, `onGoBack: () => void`, `onLogout: () => void`

**Hooks used:** `useState`×3, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `OfficesTopBar` | component | `OfficesTopBar({ user, categories, searchQuery, onOpenOffice, onSearch, on…)` | 19 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/utils.ts` — `cn`
  - `components/ui/dropdown-menu.tsx` — `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
  - `lib/discover-api.ts` — `DiscoverCategory`, `DiscoverOffice`, `(types only)`
  - `components/offices/OfficeSearchPalette.tsx` — `OfficeSearchPalette`, `shortcutLabel`
  - `components/offices/ui.tsx` — `PillButton`, `initials`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next`
  - `lucide-react` — `ArrowLeft`, `Building2`, `LogOut`, `Plus`, `Search`

## Used by

- `app/select-organization/page.tsx`
