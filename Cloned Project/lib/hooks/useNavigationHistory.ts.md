# `lib/hooks/useNavigationHistory.ts`

> React hook `useNavigationHistory`.

**Kind:** React hook · **Lines:** 196

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Hooks used:** `useState`×2, `useEffect`×2, `useRef`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `BreadcrumbItem` | interface |  | 3 |
| `HistoryEntry` | interface |  | 8 |
| `useNavigationHistory` | hook | `useNavigationHistory(activeTab: string \| null, setActiveTab: (tab: string \| null) => void)` | 13 |

## Interfaces

- **Timers / queues:** `setTimeout` at L121, L144, L163, L183

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useEffect`, `useRef`

## Used by

- `app/(dashboard)/layout.tsx`
