# `components/offices/MyOfficesView.tsx`

> React component `MyOfficesView`.

**Kind:** React component · **Lines:** 99 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `BackLink` (components/offices/ui.tsx), `Pill` (components/offices/ui.tsx), `Search` (lucide-react), `OfficeSwitcherCard` (components/offices/OfficeCard.tsx), `JoinAnotherOfficeTile` (components/offices/OfficeCard.tsx)

### Props

- **`MyOfficesView`**: `offices: MyOfficeTile[]`, `currentOrgId: string | null`, `loadingOrgId: string | null`, `onSelect: (officeId: string) => void`, `onFindMore: () => void`, `onBack: () => void`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `MyOfficeTile` | type |  | 8 |
| `MyOfficesView` | component | `MyOfficesView({ offices, currentOrgId, loadingOrgId, onSelect, onFindMore…)` — Every office you're in (and ones awaiting approval), one click to switch. | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/offices/OfficeCard.tsx` — `JoinAnotherOfficeTile`, `OfficeSwitcherCard`
  - `components/offices/ui.tsx` — `BackLink`, `Pill`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `Search`

## Used by

- `app/select-organization/page.tsx`
