# `app/docs/components/ChapterPage.tsx`

> React component `ChapterPage`.

**Kind:** Next.js app-directory module (colocated) · **Lines:** 47

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `Link`×2 (next/link), `Blocks` (app/docs/components/Blocks.tsx), `OnThisPage` (app/docs/components/OnThisPage.tsx)

### Props

- **`ChapterPage`**: `chapter: Chapter`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (ChapterPage)` | component | `ChapterPage({ chapter }: { chapter: Chapter })` — The shared body of every chapter: title block, content, pagination, rail. | 8 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/docs/content/types.ts` — `Chapter`, `(types only)`
  - `app/docs/content/index.ts` — `neighbours`, `outline`
  - `app/docs/components/Blocks.tsx` — `Blocks (default)`
  - `app/docs/components/OnThisPage.tsx` — `OnThisPage (default)`
- **Packages:**
  - `next`

## Used by

- `app/docs/[slug]/page.tsx`
