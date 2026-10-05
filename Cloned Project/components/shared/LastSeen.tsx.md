# `components/shared/LastSeen.tsx`

> React component `LastSeen`.

**Kind:** React component · **Lines:** 64 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Props

- **`LastSeen`**: `date: Date | string | null | undefined`, `prefix?: string`, `fallback?: string`, `className?: string`

**Hooks used:** `useState`, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `LastSeen` | component | `LastSeen({ date, prefix = "Active ", fallback = "", className = "", …)` — Renders a human-readable "Active X ago" affordance that replaces the green-dot online indicator across the workspace. | 21 |

## Interfaces

- **Timers / queues:** `setInterval` at L40

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`

## Used by

- `app/(dashboard)/workspace/components/UserSpaceCard.tsx`
- `components/dashboard/DashboardPage.tsx`
- `components/dashboard/FloorRoster.tsx`
- `components/dashboard/MainSidebar.tsx`
