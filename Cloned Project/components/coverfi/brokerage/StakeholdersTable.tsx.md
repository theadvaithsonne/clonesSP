# `components/coverfi/brokerage/StakeholdersTable.tsx`

> React component `StakeholdersTable`.

**Kind:** React component · **Lines:** 247 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `TableCell`×8 (components/ui/table.tsx), `TableHead`×6 (components/ui/table.tsx), `TableRow`×4 (components/ui/table.tsx), `SelectItem`×4 (components/ui/select.tsx), `Select`×2 (components/ui/select.tsx), `SelectTrigger`×2 (components/ui/select.tsx), `SelectValue`×2 (components/ui/select.tsx), `SelectContent`×2 (components/ui/select.tsx), `Badge`×2 (components/ui/badge.tsx), `Info` (lucide-react), `Link` (next/link), `Table` (components/ui/table.tsx), `TableHeader` (components/ui/table.tsx), `TableBody` (components/ui/table.tsx), `Avatar` (components/ui/avatar.tsx), `AvatarImage` (components/ui/avatar.tsx), `AvatarFallback` (components/ui/avatar.tsx)

**Hooks used:** `useState`×4, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (StakeholdersTable)` | component | `StakeholdersTable()` | 42 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/avatar.tsx` — `Avatar`, `AvatarFallback`, `AvatarImage`
  - `components/ui/badge.tsx` — `Badge`
  - `components/ui/select.tsx` — `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue`
  - `components/ui/table.tsx` — `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`
  - `lib/coverfi/brokerage-api.ts` — `listStakeholders`, `updateStakeholderAssignment`, `listLocations`
  - `lib/coverfi/roles-api.ts` — `listRoles`
  - `lib/coverfi/types.ts` — `BrokerageLocation`, `CoverfiRole`, `Stakeholder`, `(types only)`
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next`
  - `lucide-react` — `Info`
  - `sonner` — `toast`

## Used by

- `app/(dashboard)/coverfi/brokerage/employees/page.tsx`
