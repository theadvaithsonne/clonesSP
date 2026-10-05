# `components/dashboard/inlineApps/deals/DealsApp.tsx`

> React component `DealsApp`.

**Kind:** React component · **Lines:** 309 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `DealsLeadsPage`×2 (local), `DealsLeadDetailsPage` (local), `DealsFunnelPage` (local), `DealsContactsPage` (local), `DealsCompaniesPage` (local), `DealsProductsPage` (local), `DealsCmsPage` (local), `DealsDashboardPage` (local), `CmsAccessGateHost` (components/deals/cms/CmsAccessGateHost.tsx)

### Props

- **`DealsApp`**: `props: InlineAppProps`

**Hooks used:** `useEffect`×5, `useState`×3, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (DealsApp)` | component | `DealsApp({ onClose, section }: InlineAppProps)` | 74 |

## Interfaces

- **Browser storage / cookies:** `deals` (sessionStorage: inline-pending-lead-id/inline-pending-lead-id/inline-lead-id/inline-lead-id/inline-section)

## Dependencies

- **Internal:**
  - `lib/deals-events.ts` — `dispatchDealsInlineRefresh`, `DealsInlineSection`
  - `components/dashboard/inlineApps/registry.ts` — `InlineAppProps`, `(types only)`
  - `components/dashboard/inlineApps/deals/DealsMobileNav.tsx` — `DealsMobileNav (default)`
  - `components/deals/cms/CmsAccessGateHost.tsx` — `CmsAccessGateHost (default)`
- **Packages:**
  - `next`
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `X`, `BriefcaseBusiness`, `RefreshCw`

## Used by

- `components/dashboard/inlineApps/registry.ts`
