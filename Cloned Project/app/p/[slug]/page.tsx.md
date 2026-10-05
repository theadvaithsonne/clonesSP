# `app/p/[slug]/page.tsx`

> Next.js page rendered at `/p/[slug]`.

**Kind:** Next.js page · **Lines:** 87 · **Directive:** `"use client"` · **Route:** `/p/[slug]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

### Composition

**Renders:** `PageRenderer` (components/deals/cms/PageRenderer.tsx), `Suspense` (react), `PublicCmsPageInner` (local)

**Hooks used:** `useState`×5, `useParams` (next/navigation), `useSearchParams` (next/navigation), `useEffect`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `default (PublicCmsPage)` | component | `PublicCmsPage()` | 74 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `lib/cms/api.ts` — `fetchPublicCmsPage`
  - `lib/cms/types.ts` — `CmsForm`, `CmsPageContent`, `(types only)`
  - `components/deals/cms/PageRenderer.tsx` — `PageRenderer (default)`
- **Packages:**
  - `react` — `Suspense`, `useEffect`, `useState`
  - `next` — `useParams`, `useSearchParams`

## Used by

Entry: reached by the Next.js router at `/p/[slug]` (page).
