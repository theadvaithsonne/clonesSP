# `app/guest/[slug]/video/[videoId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/video/[videoId]`.

**Kind:** Next.js page · **Lines:** 167 · **Route:** `/guest/[slug]/video/[videoId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `VideoPageClient` (app/guest/[slug]/video/[videoId]/VideoPageClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared video links. | 46 |
| `default (Page)` | component | `async Page()` | 164 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/videos/${videoId}?videoType=standalone` (L64)
  - `GET /backend/public/videos/${videoId}?videoType=workshop` (L77)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L96)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`, `img.youtube.com`

## Dependencies

- **Internal:**
  - `app/guest/[slug]/video/[videoId]/VideoPageClient.tsx` — `VideoPageClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/video/[videoId]` (page).
