# `app/guest/[slug]/post/[postId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/post/[postId]`.

**Kind:** Next.js page · **Lines:** 182 · **Route:** `/guest/[slug]/post/[postId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `PostPageClient` (app/guest/[slug]/post/[postId]/PostPageClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared post links. | 47 |
| `default (Page)` | component | `async Page()` | 178 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/posts/${postId}` (L62)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L79)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/guest/[slug]/post/[postId]/PostPageClient.tsx` — `PostPageClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/post/[postId]` (page).
