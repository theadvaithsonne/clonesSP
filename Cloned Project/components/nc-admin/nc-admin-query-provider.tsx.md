# `components/nc-admin/nc-admin-query-provider.tsx`

> Scoped React Query provider for the ported NetworkChains admin section (app/garage-admin/(admin-dashboard)/networkchains).

**Kind:** React component · **Lines:** 23 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Scoped React Query provider for the ported NetworkChains admin section
(app/garage-admin/(admin-dashboard)/networkchains). Garage doesn't use React
Query app-wide — see components/downline/downline-query-provider.tsx and
components/vaults/vaults-query-provider.tsx for the same pattern — and every
NC admin page is built on useQuery, so the section gets its own QueryClient.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `QueryClientProvider` (@tanstack/react-query)

### Props

- **`NcAdminQueryProvider`**: `children: ReactNode`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NcAdminQueryProvider` | component | `NcAdminQueryProvider({ children }: { children: ReactNode })` | 12 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `ReactNode`
  - `@tanstack/react-query` — `QueryClient`, `QueryClientProvider`

## Used by

- `app/garage-admin/(admin-dashboard)/networkchains/layout.tsx`
