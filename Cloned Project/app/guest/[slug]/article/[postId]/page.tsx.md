# `app/guest/[slug]/article/[postId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/article/[postId]`.

**Kind:** Next.js page · **Lines:** 179 · **Route:** `/guest/[slug]/article/[postId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `ArticlePageClient` (app/guest/[slug]/article/[postId]/ArticlePageClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared article links. | 47 |
| `default (Page)` | component | `async Page()` | 176 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/posts/${postId}` (L62)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L78)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/guest/[slug]/article/[postId]/ArticlePageClient.tsx` — `ArticlePageClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/article/[postId]` (page).
