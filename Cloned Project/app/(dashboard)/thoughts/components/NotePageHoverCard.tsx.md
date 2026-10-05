# `app/(dashboard)/thoughts/components/NotePageHoverCard.tsx`

> React components `NotePageHoverCard`, `PageTypeBadge`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 250 · **Directive:** `"use client"`

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2` (lucide-react), `FileText` (lucide-react)

### Props

- **`NotePageHoverCard`**: `noteId: string`, `children: React.ReactNode`, `className?: string`, `disabled?: boolean`
- **`PageTypeBadge`**: `parentId?: string | null`, `className?: string`

**Hooks used:** `useState`×5, `useCallback`×4, `useRef`×3, `useEffect`×3

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `NotePagePreviewData` | interface |  | 10 |
| `default (NotePageHoverCard)` | component | `NotePageHoverCard({ noteId, children, className, disabled, }: NotePageHoverCa…)` — Notion-style hover preview: icon → breadcrumb path → page title. | 82 |
| `PageTypeBadge` | component | `PageTypeBadge({ parentId, className, }: { parentId?: string \| null; class…)` — Compact badge for page pickers: Sub-page vs Page | 230 |

## Interfaces

- **Timers / queues:** `setTimeout` at L131, L147

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
  - `app/(dashboard)/thoughts/types.ts` — `NoteBreadcrumbItem`, `(types only)`
- **Packages:**
  - `react` — `useCallback`, `useEffect`, `useRef`, `useState`
  - `react-dom` — `createPortal`
  - `lucide-react` — `FileText`, `Loader2`

## Used by

- `app/(dashboard)/thoughts/components/blocks/MentionPageBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/NestedPageBlock.tsx`
- `app/(dashboard)/thoughts/components/blocks/PageLinkPillBlock.tsx`
