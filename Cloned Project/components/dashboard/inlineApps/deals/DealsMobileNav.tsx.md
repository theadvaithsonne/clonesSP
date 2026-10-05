# `components/dashboard/inlineApps/deals/DealsMobileNav.tsx`

> React component `DealsMobileNav`.

**Kind:** React component · **Lines:** 114 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Menu` (lucide-react), `Sheet` (components/ui/sheet.tsx), `SheetContent` (components/ui/sheet.tsx), `SheetHeader` (components/ui/sheet.tsx), `BriefcaseBusiness` (lucide-react), `SheetTitle` (components/ui/sheet.tsx), `Icon` (local)

### Props

- **`DealsMobileNav`**: `activeSection: DealsNavSection`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DealsNavSection` | type |  | 24 |
| `default (DealsMobileNav)` | component | `DealsMobileNav({ activeSection }: DealsMobileNavProps)` | 51 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/ui/sheet.tsx` — `Sheet`, `SheetContent`, `SheetHeader`, `SheetTitle`
  - `lib/deals-events.ts` — `dispatchDealsInlineNavigate`
- **Packages:**
  - `react` — `useState`
  - `lucide-react` — `LayoutDashboard`, `UserPlus`, `TrendingUp`, `Users2`, `Building`, `Package`, …

## Used by

- `components/dashboard/inlineApps/deals/DealsApp.tsx`
