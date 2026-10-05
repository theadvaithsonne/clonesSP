# `app/(dashboard)/thoughts/components/blocks/CalendarViewBlock.tsx`

> Module exporting `calendarViewBlock`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 284 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `ChevronLeft` (lucide-react), `ChevronRight` (lucide-react), `Plus` (lucide-react), `FileDown` (lucide-react), `CalendarBlock` (local)

**Hooks used:** `useState`×5, `useCallback`×4, `useRef`×3, `useEffect`×2

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `calendarViewBlock` | const | `= createReactBlockSpec( { type: "calendarView" as const, propSchema: { events: { default: "{}", typ…` | 272 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:** none
- **Packages:**
  - `react` — `useState`, `useCallback`, `useRef`, `useEffect`
  - `lucide-react` — `ChevronLeft`, `ChevronRight`, `Plus`, `FileDown`
  - `@blocknote/react` — `createReactBlockSpec`

## Used by

- `app/(dashboard)/thoughts/components/blocks/index.ts`
