# `app/webinar/[id]/page.tsx`

> Next.js page rendered at `/webinar/[id]`.

**Kind:** Next.js page · **Lines:** 149 · **Route:** `/webinar/[id]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `WebinarRoomClient` (app/webinar/[id]/WebinarRoomClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared webinar / live-stream affiliate links. | 36 |
| `default (Page)` | component | `Page()` | 146 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/workshops/${webinarId}` (L55)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L72)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/webinar/[id]/WebinarRoomClient.tsx` — `WebinarRoomClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/webinar/[id]` (page).
