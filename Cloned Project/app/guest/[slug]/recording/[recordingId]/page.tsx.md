# `app/guest/[slug]/recording/[recordingId]/page.tsx`

> Next.js page rendered at `/guest/[slug]/recording/[recordingId]`.

**Kind:** Next.js page · **Lines:** 136 · **Route:** `/guest/[slug]/recording/[recordingId]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `RecordingPageClient` (app/guest/[slug]/recording/[recordingId]/RecordingPageClient.tsx)

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params, searchParams, }: Props): Promise<Metadata>` — Server-side metadata generation for OG tags on shared recording links. | 36 |
| `default (Page)` | component | `async Page()` | 133 |

## Interfaces

- **Backend endpoints called (via `/backend`):**
  - `GET /backend/public/recordings/${recordingId}` (L51)
  - `GET /backend/affiliate/referrer-info?affiliateId=${referCode}` (L68)
- **Environment variables (`process.env`):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `VERCEL_PROJECT_PRODUCTION_URL`, `VERCEL_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `app/guest/[slug]/recording/[recordingId]/RecordingPageClient.tsx` — `RecordingPageClient (default)`
- **Packages:**
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/guest/[slug]/recording/[recordingId]` (page).
