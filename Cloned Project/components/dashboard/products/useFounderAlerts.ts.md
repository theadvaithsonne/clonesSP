# `components/dashboard/products/useFounderAlerts.ts`

> React hook `useFounderAlerts`.

**Kind:** React component · **Lines:** 64 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useCallback`×4, `useState`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `FounderAlerts` | export |  | 10 |
| `useFounderAlerts` | hook | `useFounderAlerts(initial?: Partial<FounderAlerts> \| null)` — Shared form logic for the founder's "notify me when someone joins" toggle, used by the community, course, product, live stream, service and event forms. | 23 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/feed-api.ts` — `FounderAlerts`, `(types only)`
  - `components/dashboard/products/FounderAlertsSection.tsx` — `FounderAlertsValue`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useState`

## Used by

- `components/dashboard/ChannelsPage.tsx`
- `components/dashboard/CoursesPage.tsx`
- `components/dashboard/ProductsPage.tsx`
- `components/dashboard/ServiceFormModal.tsx`
- `components/dashboard/WorkshopsPage.tsx`
- `components/dashboard/inlineApps/events/CreateEventModal.tsx`
