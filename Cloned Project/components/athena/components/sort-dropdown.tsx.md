# `components/athena/components/sort-dropdown.tsx`

> An empty placeholder for a sort-order dropdown ("old-to-new" or "new-to-old") that renders nothing.

**Kind:** React component · **Lines:** 16

## Purpose
It was meant to let the Athena board dashboard switch the sort order of its items. The UI has been removed: the component keeps its props interface but returns an empty fragment.

## How it works
- It declares `SortDropdownProps { value: "old-to-new" | "new-to-old"; onChange(value) }`.
- The default export ignores both props and returns `<></>`.
- `ChevronDown` is imported from `lucide-react` but never used.

## Exports
- `default SortDropdown({ value, onChange })` - renders nothing.

## Dependencies
- **Packages:** `lucide-react` (unused import).

## Used by
The import graph lists `components/athena/components/Dashbaord.tsx`, but that import is commented out there (`// import SortDropdown from "./sort-dropdown"`). Nothing else imports it, so it appears unused. Another file at `app/(dashboard)/flowboard/[symbol]/components/` also has a commented-out `./sort-dropdown` import; that refers to its own sibling file, not this one.

## Notes
- This is dead code and can be deleted safely, or re-implemented if sorting comes back.
