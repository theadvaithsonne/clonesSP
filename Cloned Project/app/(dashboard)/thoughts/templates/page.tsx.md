# `app/(dashboard)/thoughts/templates/page.tsx`

> Next.js page rendered at `/thoughts/templates`.

**Kind:** Next.js page · **Lines:** 1571 · **Directive:** `"use client"` · **Route:** `/thoughts/templates` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Button`×5 (components/ui/button.tsx), `LayoutTemplate`×2 (lucide-react), `Plus`×2 (lucide-react), `Search` (lucide-react), `Input` (components/ui/input.tsx), `Card` (components/ui/card.tsx), `CardHeader` (components/ui/card.tsx), `Icon` (local), `CardTitle` (components/ui/card.tsx), `CardContent` (components/ui/card.tsx), `CardDescription` (components/ui/card.tsx), `Dialog` (components/ui/dialog.tsx), `DialogContent` (components/ui/dialog.tsx), `DialogHeader` (components/ui/dialog.tsx), `DialogTitle` (components/ui/dialog.tsx), `BlockNoteView` (@blocknote/mantine)

**Hooks used:** `useState`×3, `useRouter` (next/navigation), `useCreateBlockNote` (@blocknote/react)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (TemplatesPage)` | component | `TemplatesPage()` | 1346 |

## Interfaces

- **Timers / queues:** `setTimeout` at L1393
- **External hosts mentioned in the code:** `react.dev`

## Dependencies

- **Internal:**
  - `lib/thoughts-events.ts` — `isThoughtsInlineMode`, `dispatchThoughtsInlineNavigate`
  - `components/ui/button.tsx` — `Button`
  - `components/ui/dialog.tsx` — `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
  - `components/ui/input.tsx` — `Input`
  - `components/ui/card.tsx` — `Card`, `CardContent`, `CardDescription`, `CardHeader`, `CardTitle`
  - `lib/utils.ts` — `cn`
  - `app/(dashboard)/thoughts/components/blocks/index.ts` — `coverPhotoBlock`, `documentListBlock`, `calendarViewBlock`, `timelineViewBlock`, `chartViewBlock`, `linkedViewBlock`, `tableViewBlock`, `boardViewBlock`, … +8
  - `lib/api-config.ts` — `buildExternalUrl`
  - `utils/api.ts` — `authenticatedFetch`
- **Packages:**
  - `react` — `useState`
  - `next` — `useRouter`
  - `lucide-react` — `LayoutTemplate`, `Search`, `Plus`, `FileText`, `Briefcase`, `ListChecks`, …
  - `@blocknote/react` — `useCreateBlockNote`
  - `@blocknote/mantine` — `BlockNoteView`
  - `@blocknote/core` — `BlockNoteSchema`, `defaultBlockSpecs`
  - `sonner` — `toast`

## Used by

- `components/dashboard/inlineApps/thoughts/ThoughtsApp.tsx`

Entry: reached by the Next.js router at `/thoughts/templates` (page).

## Notes

- Large file (1571 lines) — read it by section; line numbers above point into it.
