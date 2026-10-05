# `app/guest/[slug]/drop/[dropId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/drop/[dropId]`.

**Kind:** Next.js page · **Lines:** 138 · **Route:** `/guest/[slug]/drop/[dropId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `DropPageClient` (app/guest/[slug]/drop/[dropId]/DropPageClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared drop links. | 43 |
| `default (Page)` | component | `async Page()` | 135 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/drops/public/${dropId}` (L56)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L71)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`, `img.youtube.com`

## Dependencies

- **Internal:**
  - `app/guest/[slug]/drop/[dropId]/DropPageClient.tsx` — `DropPageClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/drop/[dropId]` (page).
