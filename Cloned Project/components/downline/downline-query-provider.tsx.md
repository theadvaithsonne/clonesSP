# `components/downline/downline-query-provider.tsx`

> Scoped React Query provider for the ported one-time-affiliate profile page (app/garage-admin/(admin-dashboard)/one-time-affiliates/[userId]).

**Kind:** React component · **Lines:** 28 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
Scoped React Query provider for the ported one-time-affiliate profile page
(app/garage-admin/(admin-dashboard)/one-time-affiliates/[userId]). Garage
doesn't use React Query app-wide (see components/vaults/vaults-query-provider.tsx
for the same pattern used by the Vaults feature), and the ported NC profile
page is built on useQuery, so it gets its own QueryClient rather than
requiring a global provider.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `QueryClientProvider` (@tanstack/react-query)

### Props

- **`DownlineQueryProvider`**: `children: ReactNode`

**Hooks used:** `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `DownlineQueryProvider` | component | `DownlineQueryProvider({ children }: { children: ReactNode })` | 13 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `ReactNode`
  - `@tanstack/react-query` — `QueryClient`, `QueryClientProvider`

## Used by

- `components/garage-admin/member-profile-view.tsx`
