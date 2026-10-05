# `app/(dashboard)/thoughts/components/NotionDropdownItem.tsx`

> React component `NotionDropdownItem`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 265 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `NotionDropdownItem`×2 (local), `FileText` (lucide-react), `ChevronDown` (lucide-react), `ChevronRight` (lucide-react)

### Props

- **`NotionDropdownItem`**: `note: NoteItemData`, `onSelect: (noteId: string) => void`, `activeNoteId?: string`, `highlightNoteId?: string`, `allNotes?: NoteItemData[]`, `depth?: number`, `preferInlineSubpages?: boolean`

**Hooks used:** `useState`×6, `useRef`×3, `useEffect`, `useCallback`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NoteItemData` | interface |  | 9 |
| `default (NotionDropdownItem)` | component | `NotionDropdownItem({ note, onSelect, activeNoteId, highlightNoteId, allNotes =…)` | 30 |

## Interfaces

- **Timers / queues:** `setTimeout` at L119, L136

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
- **Packages:**
  - `react` — `useState`, `useRef`, `useEffect`, `useCallback`
  - `react-dom` — `createPortal`
  - `lucide-react` — `ChevronRight`, `FileText`, `Loader2`, `ChevronDown`

## Used by

- `app/(dashboard)/thoughts/components/NoteBreadcrumbs.tsx`
- `app/(dashboard)/thoughts/page.tsx`
