# `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx`

> React component `ThoughtsApp`.

**Kind:** React component · **Lines:** 262 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ThoughtsStarredPage` (local), `ThoughtsTemplatesPage` (local), `ThoughtsArchivePage` (local), `ThoughtsTrashPage` (local), `ThoughtsRecoveryPage` (local), `ThoughtsAllNotesPage` (local)

### Props

- **`ThoughtsApp`**: `props: InlineAppProps`

**Hooks used:** `useState`, `useEffect`, `useMemo`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ThoughtsApp)` | component | `ThoughtsApp({ onClose, section }: InlineAppProps)` | 58 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `components/dashboard/inlineApps/registry.ts` — `InlineAppProps`, `(types only)`
- **Packages:**
  - `next`
  - `react` — `useEffect`, `useMemo`, `useState`
  - `lucide-react` — `X`, `FileText`

## Used by

- `components/dashboard/inlineApps/registry.ts`
