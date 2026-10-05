# `app/(dashboard)/flowboard/[symbol]/components/sort-dropdown.tsx`

> An empty placeholder for a Flowboard sort selector: it declares the props but renders nothing.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 16

## Purpose

This component was meant to be the "Old to New / New to Old" sort control for the Kanban board. That control was instead written inline in `kanban-board.tsx` as a native `<select>`, which calls `onChangeSort`. This file was left as a stub.

## How it works

`SortDropdown` takes `value` and `onChange` props but returns an empty fragment (`<></>`). It ignores both props and has no state, effects or markup.

## Exports
- `default SortDropdown({ value, onChange })`
  - `value: "old-to-new" | "new-to-old"`
  - `onChange(value)`
  - It renders nothing.

## Dependencies
- **Packages:** `lucide-react` (`ChevronDown` is imported but unused).

## Used by
Listed as imported by `kanban-board.tsx`, but that import and its JSX usage (`<SortDropdown value={sortOrder} onChange={setSortOrder} />`) are both commented out there. In practice the component is unused.

## Notes
- This is dead code.
- An identical stub exists at `components/athena/components/sort-dropdown.tsx`, and it is also only referenced from a commented-out import (in `components/athena/components/Dashbaord.tsx`).
