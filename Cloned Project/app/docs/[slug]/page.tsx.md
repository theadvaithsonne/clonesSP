# `app/docs/[slug]/page.tsx`

> Next.js page rendered at `/docs/[slug]`.

**Kind:** Next.js page · **Lines:** 31 · **Route:** `/docs/[slug]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateStaticParams`, `generateMetadata`

### Composition

**Renders:** `ChapterPage` (app/docs/components/ChapterPage.tsx)

### Props

- **`Chapter`**: `params: Promise<{ slug: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateStaticParams` | function | `generateStaticParams()` | 6 |
| `generateMetadata` | function | `async generateMetadata({ params, }: { params: Promise<{ slug: string }>; }): Promise<Metadata>` | 10 |
| `default (Chapter)` | component | `async Chapter({ params, }: { params: Promise<{ slug: string }>; })` | 21 |

## Interfaces

None detected: no endpoints, events, data access or environment reads were found.

## Dependencies

- **Internal:**
  - `app/docs/content/index.ts` — `CHAPTERS`, `chapterBySlug`
  - `app/docs/components/ChapterPage.tsx` — `ChapterPage (default)`
- **Packages:**
  - `next` — `Metadata`, `notFound`

## Used by

Entry: reached by the Next.js router at `/docs/[slug]` (page).
