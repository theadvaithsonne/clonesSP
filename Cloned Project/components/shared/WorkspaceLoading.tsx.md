# `components/shared/WorkspaceLoading.tsx`

> React component `WorkspaceLoading`.

**Kind:** React component · **Lines:** 147 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Icon` (local)

### Props

- **`WorkspaceLoading`**: `message?: string`, `backgroundClass?: string`, `textClass?: string`, `cycleIntervalMs?: number`

**Hooks used:** `useState`×2, `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `WorkspaceLoading` | component | `WorkspaceLoading({ message = "Loading your Workspace", backgroundClass = "bg…)` | 42 |

## Interfaces

- **Timers / queues:** `setInterval` at L52

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `lucide-react` — `LucideIcon`, `LayoutGrid`, `List`, `Calendar`, `BarChart3`, `FileSpreadsheet`, …

## Used by

- `app/taskroom/Layout.tsx`
- `app/taskroom/page.tsx`
- `components/athena/ProjectMangement.tsx`
