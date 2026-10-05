# `app/shared/note/[token]/page.tsx`

> Next.js page rendered at `/shared/note/[token]`.

**Kind:** Next.js page · **Lines:** 268 · **Directive:** `"use client"` · **Route:** `/shared/note/[token]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Loader2`×2 (lucide-react), `Globe` (lucide-react), `BlockNoteView` (@blocknote/mantine)

**Hooks used:** `useState`×4, `useEffect`×3, `useParams` (next/navigation), `useCreateBlockNote` (@blocknote/react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (SharedNotePage)` | component | `SharedNotePage()` | 54 |

## Interfaces

- **Timers / queues:** `setTimeout` at L155

## Dependencies

- **Internal:**
  - `lib/api-config.ts` — `buildExternalUrl`
  - `app/(dashboard)/thoughts/components/blocks/index.ts` — `coverPhotoBlock`, `documentListBlock`, `calendarViewBlock`, `timelineViewBlock`, `chartViewBlock`, `linkedViewBlock`, `tableViewBlock`, `boardViewBlock`, … +19
- **Packages:**
  - `react` — `useEffect`, `useState`
  - `next` — `useParams`
  - `lucide-react` — `Loader2`, `Globe`
  - `sonner` — `toast`
  - `@blocknote/mantine` — `BlockNoteView`
  - `@blocknote/react` — `useCreateBlockNote`
  - `@blocknote/core` — `defaultBlockSpecs`, `BlockNoteSchema`

## Used by

Entry: reached by the Next.js router at `/shared/note/[token]` (page).
