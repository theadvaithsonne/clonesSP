# `app/jobs/[id]/[jobSlug]/page.tsx`

> Next.js page rendered at `/jobs/[id]/[jobSlug]`.

**Kind:** Next.js page · **Lines:** 83 · **Route:** `/jobs/[id]/[jobSlug]` (page)

<!-- docgen:auto -->

## Purpose
The source has no header comment; what follows is read straight from its code.

> **Auto-generated overview.** The tables below were extracted from the source by a script (exports, endpoints, events, data access, dependencies). A written walkthrough of the logic has not been added yet.

## Overview (auto-extracted)

**Next.js route config exports:** `generateMetadata`

### Composition

**Renders:** `Suspense` (react), `PublicJobClient` (components/jobs-public/PublicJobClient.tsx)

### Props

- **`PublicJobPage`**: `params: Promise<{ id: string; jobSlug: string }>`

## Exports

| Name | Kind | Signature / value | Line |
|---|---|---|---|
| `generateMetadata` | function | `async generateMetadata({ params }: PageProps): Promise<Metadata>` | 37 |
| `default (PublicJobPage)` | component | `async PublicJobPage({ params }: PageProps)` | 74 |

## Interfaces

- **Environment variables (`process.env`):** `NEXT_PUBLIC_APP_URL`
- **External hosts mentioned in the code:** `my.garage.app`

## Dependencies

- **Internal:**
  - `components/jobs-public/PublicJobClient.tsx` — `PublicJobClient (default)`
  - `components/jobs-public/api.ts` — `fetchPublicJob`
- **Packages:**
  - `react` — `Suspense`
  - `next` — `Metadata`

## Used by

Entry: reached by the Next.js router at `/jobs/[id]/[jobSlug]` (page).
