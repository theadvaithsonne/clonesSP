# `app/guest/[slug]/webinar/[webinarId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/webinar/[webinarId]`.

**Kind:** Next.js page · **Lines:** 142 · **Route:** `/guest/[slug]/webinar/[webinarId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `WebinarDetailPageClient` (app/guest/[slug]/webinar/[webinarId]/WebinarDetailPageClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared guest webinar links. | 33 |
| `default (Page)` | component | `async Page()` | 139 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/workshops/${webinarId}` (L52)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L69)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/guest/[slug]/webinar/[webinarId]/WebinarDetailPageClient.tsx` — `WebinarDetailPageClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/webinar/[webinarId]` (page).
